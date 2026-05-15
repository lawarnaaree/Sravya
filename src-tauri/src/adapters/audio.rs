use std::{
    fs::File,
    io::BufReader,
    path::PathBuf,
    sync::{Arc, Mutex, RwLock},
    thread,
    time::{Duration, Instant},
};

use rodio::{source::SeekError, Decoder, OutputStream, Sink, Source};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::core::playback::EQ_FREQUENCIES;

// ── EQ config (shared between audio thread and command handlers) ───────────

#[derive(Clone, Debug)]
pub struct EqConfig {
    pub enabled: bool,
    pub preamp_db: f32,
    pub bands: [f32; 10],
}

impl Default for EqConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            preamp_db: 0.0,
            bands: [0.0; 10],
        }
    }
}

// ── Biquad peaking EQ ─────────────────────────────────────────────────────

#[derive(Clone, Default)]
struct BiquadCoeffs {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
}

#[derive(Clone, Default)]
struct BiquadState {
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl BiquadState {
    fn process(&mut self, x: f32, c: &BiquadCoeffs) -> f32 {
        let y = c.b0 * x + c.b1 * self.x1 + c.b2 * self.x2 - c.a1 * self.y1 - c.a2 * self.y2;
        self.x2 = self.x1;
        self.x1 = x;
        self.y2 = self.y1;
        self.y1 = y;
        y
    }
}

fn db_to_linear(db: f32) -> f32 {
    10f32.powf(db / 20.0)
}

fn peaking_coeffs(freq_hz: u32, sample_rate: u32, gain_db: f32) -> BiquadCoeffs {
    if gain_db.abs() < 0.01 {
        return BiquadCoeffs {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
        };
    }
    let a = 10f32.powf(gain_db / 40.0);
    let w0 = 2.0 * std::f32::consts::PI * freq_hz as f32 / sample_rate as f32;
    // Q = sqrt(2) for a Butterworth-style shelf
    let alpha = w0.sin() / 2.828_427;
    let cos_w0 = w0.cos();

    let b0 = 1.0 + alpha * a;
    let b1 = -2.0 * cos_w0;
    let b2 = 1.0 - alpha * a;
    let a0_inv = 1.0 / (1.0 + alpha / a);
    let a2_num = 1.0 - alpha / a;

    BiquadCoeffs {
        b0: b0 * a0_inv,
        b1: b1 * a0_inv,
        b2: b2 * a0_inv,
        a1: b1 * a0_inv,
        a2: a2_num * a0_inv,
    }
}

// ── GainEqSource ──────────────────────────────────────────────────────────

pub struct GainEqSource<S: Source<Item = f32>> {
    inner: S,
    channels: u16,
    sample_rate: u32,
    replaygain_db: f32,
    gain: f32,
    eq_config: Arc<RwLock<EqConfig>>,
    eq_enabled: bool,
    coeffs: [BiquadCoeffs; 10],
    ch_states: Vec<[BiquadState; 10]>,
    ch_cursor: usize,
    check_counter: u32,
}

impl<S: Source<Item = f32>> GainEqSource<S> {
    pub fn new(source: S, replaygain_db: f32, eq_config: Arc<RwLock<EqConfig>>) -> Self {
        let channels = source.channels().max(1) as usize;
        let sample_rate = source.sample_rate();

        let (gain, eq_enabled, coeffs) = {
            let cfg = eq_config.read().unwrap();
            let gain = db_to_linear(replaygain_db + cfg.preamp_db);
            let coeffs: [BiquadCoeffs; 10] = std::array::from_fn(|i| {
                peaking_coeffs(EQ_FREQUENCIES[i], sample_rate, cfg.bands[i])
            });
            (gain, cfg.enabled, coeffs)
        };

        let ch_states: Vec<[BiquadState; 10]> = (0..channels)
            .map(|_| std::array::from_fn(|_| BiquadState::default()))
            .collect();

        Self {
            inner: source,
            channels: channels as u16,
            sample_rate,
            replaygain_db,
            gain,
            eq_config,
            eq_enabled,
            coeffs,
            ch_states,
            ch_cursor: 0,
            check_counter: 0,
        }
    }

    fn refresh_config(&mut self) {
        if let Ok(cfg) = self.eq_config.try_read() {
            self.gain = db_to_linear(self.replaygain_db + cfg.preamp_db);
            self.eq_enabled = cfg.enabled;
            for i in 0..10 {
                self.coeffs[i] = peaking_coeffs(EQ_FREQUENCIES[i], self.sample_rate, cfg.bands[i]);
            }
        }
    }

    fn reset_states(&mut self) {
        for ch in &mut self.ch_states {
            for state in ch.iter_mut() {
                *state = BiquadState::default();
            }
        }
        self.ch_cursor = 0;
    }
}

impl<S: Source<Item = f32>> Iterator for GainEqSource<S> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        let s = self.inner.next()?;

        self.check_counter += 1;
        if self.check_counter >= 1024 {
            self.check_counter = 0;
            self.refresh_config();
        }

        let mut sample = s * self.gain;

        if self.eq_enabled && !self.ch_states.is_empty() {
            let ch = self.ch_cursor % self.ch_states.len();
            for band in 0..10 {
                let c = self.coeffs[band].clone();
                sample = self.ch_states[ch][band].process(sample, &c);
            }
        }

        self.ch_cursor = self.ch_cursor.wrapping_add(1);
        Some(sample.clamp(-1.0, 1.0))
    }
}

impl<S: Source<Item = f32>> Source for GainEqSource<S> {
    fn current_frame_len(&self) -> Option<usize> {
        self.inner.current_frame_len()
    }
    fn channels(&self) -> u16 {
        self.channels
    }
    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }
    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }
    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.reset_states();
        self.check_counter = 0;
        self.inner.try_seek(pos)
    }
}

// ── Engine state ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RepeatMode {
    Off,
    One,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineState {
    pub is_playing: bool,
    pub current_track_id: Option<Uuid>,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub volume: f32,
    pub muted: bool,
    pub queue: Vec<Uuid>,
    pub queue_index: usize,
    pub shuffle: bool,
    pub repeat: RepeatMode,
}

impl Default for EngineState {
    fn default() -> Self {
        Self {
            is_playing: false,
            current_track_id: None,
            position_ms: 0,
            duration_ms: 0,
            volume: 0.8,
            muted: false,
            queue: Vec::new(),
            queue_index: 0,
            shuffle: false,
            repeat: RepeatMode::Off,
        }
    }
}

pub struct QueueEntry {
    pub track_id: Uuid,
    pub path: PathBuf,
    pub duration_ms: u64,
    pub replaygain_db: f32,
}

pub enum AudioCommand {
    Play {
        path: PathBuf,
        track_id: Uuid,
        duration_ms: u64,
        replaygain_db: f32,
    },
    PlayQueue {
        entries: Vec<QueueEntry>,
        index: usize,
    },
    Pause,
    Resume,
    Stop,
    Seek(u64),
    SetVolume(f32),
    Mute,
    Unmute,
    Next,
    Previous,
    SetShuffle(bool),
    SetRepeat(RepeatMode),
    QueueAdd(QueueEntry),
    QueueRemove(usize),
    QueueClear,
}

pub struct AudioEngine {
    command_tx: std::sync::mpsc::SyncSender<AudioCommand>,
    pub state: Arc<Mutex<EngineState>>,
    pub eq_config: Arc<RwLock<EqConfig>>,
}

impl AudioEngine {
    pub fn new() -> Self {
        let (tx, rx) = std::sync::mpsc::sync_channel::<AudioCommand>(64);
        let state = Arc::new(Mutex::new(EngineState::default()));
        let eq_config = Arc::new(RwLock::new(EqConfig::default()));

        let state_clone = Arc::clone(&state);
        let eq_clone = Arc::clone(&eq_config);
        thread::spawn(move || run_audio_loop(rx, state_clone, eq_clone));

        Self {
            command_tx: tx,
            state,
            eq_config,
        }
    }

    pub fn send(&self, cmd: AudioCommand) {
        let _ = self.command_tx.try_send(cmd);
    }

    pub fn get_state(&self) -> EngineState {
        self.state.lock().unwrap().clone()
    }
}

fn run_audio_loop(
    rx: std::sync::mpsc::Receiver<AudioCommand>,
    state: Arc<Mutex<EngineState>>,
    eq_config: Arc<RwLock<EqConfig>>,
) {
    let (_stream, stream_handle) = match OutputStream::try_default() {
        Ok(pair) => pair,
        Err(e) => {
            eprintln!("Audio device error: {e}");
            return;
        }
    };

    let sink = Sink::try_new(&stream_handle).expect("failed to create sink");
    sink.set_volume(0.8);

    let mut local_queue: Vec<QueueEntry> = Vec::new();
    let mut local_index: usize = 0;
    let mut play_started_at: Option<Instant> = None;
    let mut seek_offset_ms: u64 = 0;

    let tick = Duration::from_millis(100);

    loop {
        loop {
            match rx.try_recv() {
                Ok(cmd) => handle_command(
                    cmd,
                    &sink,
                    &state,
                    &mut local_queue,
                    &mut local_index,
                    &mut play_started_at,
                    &mut seek_offset_ms,
                    &eq_config,
                ),
                Err(std::sync::mpsc::TryRecvError::Empty) => break,
                Err(std::sync::mpsc::TryRecvError::Disconnected) => return,
            }
        }

        // Auto-advance when track finishes.
        {
            let s = state.lock().unwrap();
            let was_playing = s.is_playing;
            let repeat = s.repeat.clone();
            drop(s);

            let track_done = was_playing && sink.empty() && !local_queue.is_empty();
            if track_done {
                let next_index = match repeat {
                    RepeatMode::One => local_index,
                    RepeatMode::All => (local_index + 1) % local_queue.len(),
                    RepeatMode::Off => local_index + 1,
                };
                if next_index < local_queue.len() {
                    load_entry(&sink, &local_queue[next_index], &state, &eq_config);
                    play_started_at = Some(Instant::now());
                    seek_offset_ms = 0;
                    local_index = next_index;
                } else {
                    let mut s = state.lock().unwrap();
                    s.is_playing = false;
                    s.position_ms = s.duration_ms;
                }
            }
        }

        // Update position from manual timer.
        {
            let mut s = state.lock().unwrap();
            if s.is_playing && !sink.is_paused() {
                if let Some(started) = play_started_at {
                    let elapsed_ms = started.elapsed().as_millis() as u64;
                    s.position_ms = (seek_offset_ms + elapsed_ms).min(s.duration_ms);
                }
            }
        }

        thread::sleep(tick);
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_command(
    cmd: AudioCommand,
    sink: &Sink,
    state: &Arc<Mutex<EngineState>>,
    local_queue: &mut Vec<QueueEntry>,
    local_index: &mut usize,
    play_started_at: &mut Option<Instant>,
    seek_offset_ms: &mut u64,
    eq_config: &Arc<RwLock<EqConfig>>,
) {
    match cmd {
        AudioCommand::Play {
            path,
            track_id,
            duration_ms,
            replaygain_db,
        } => {
            local_queue.clear();
            *local_index = 0;
            let entry = QueueEntry {
                track_id,
                path,
                duration_ms,
                replaygain_db,
            };
            load_entry(sink, &entry, state, eq_config);
            *play_started_at = Some(Instant::now());
            *seek_offset_ms = 0;

            let mut s = state.lock().unwrap();
            s.queue = vec![track_id];
            s.queue_index = 0;
            drop(s);

            local_queue.push(entry);
        }

        AudioCommand::PlayQueue { entries, index } => {
            *local_index = index.min(entries.len().saturating_sub(1));
            if !entries.is_empty() {
                load_entry(sink, &entries[*local_index], state, eq_config);
                *play_started_at = Some(Instant::now());
                *seek_offset_ms = 0;
                let ids: Vec<Uuid> = entries.iter().map(|e| e.track_id).collect();
                let mut s = state.lock().unwrap();
                s.queue = ids;
                s.queue_index = *local_index;
                drop(s);
            }
            *local_queue = entries;
        }

        AudioCommand::Pause => {
            sink.pause();
            if let Some(started) = *play_started_at {
                *seek_offset_ms += started.elapsed().as_millis() as u64;
                *play_started_at = None;
            }
            state.lock().unwrap().is_playing = false;
        }

        AudioCommand::Resume => {
            sink.play();
            *play_started_at = Some(Instant::now());
            state.lock().unwrap().is_playing = true;
        }

        AudioCommand::Stop => {
            sink.stop();
            *play_started_at = None;
            *seek_offset_ms = 0;
            let mut s = state.lock().unwrap();
            s.is_playing = false;
            s.position_ms = 0;
            s.current_track_id = None;
        }

        AudioCommand::Seek(ms) => {
            let pos = Duration::from_millis(ms);
            if sink.try_seek(pos).is_ok() {
                *seek_offset_ms = ms;
                let is_playing = state.lock().unwrap().is_playing && !sink.is_paused();
                *play_started_at = if is_playing {
                    Some(Instant::now())
                } else {
                    None
                };
                state.lock().unwrap().position_ms = ms;
            } else if !local_queue.is_empty() {
                // Fallback for formats that don't support seeking: restart track.
                load_entry(sink, &local_queue[*local_index], state, eq_config);
                *seek_offset_ms = 0;
                *play_started_at = Some(Instant::now());
            }
        }

        AudioCommand::SetVolume(v) => {
            let level = v.clamp(0.0, 1.0);
            sink.set_volume(level);
            let mut s = state.lock().unwrap();
            s.volume = level;
            s.muted = false;
        }

        AudioCommand::Mute => {
            sink.set_volume(0.0);
            state.lock().unwrap().muted = true;
        }

        AudioCommand::Unmute => {
            let vol = state.lock().unwrap().volume;
            sink.set_volume(vol);
            state.lock().unwrap().muted = false;
        }

        AudioCommand::Next => {
            let next = *local_index + 1;
            if next < local_queue.len() {
                *local_index = next;
                load_entry(sink, &local_queue[*local_index], state, eq_config);
                *play_started_at = Some(Instant::now());
                *seek_offset_ms = 0;
                state.lock().unwrap().queue_index = *local_index;
            }
        }

        AudioCommand::Previous => {
            let pos = *seek_offset_ms
                + play_started_at
                    .map(|t| t.elapsed().as_millis() as u64)
                    .unwrap_or(0);
            if pos > 3000 || *local_index == 0 {
                if !local_queue.is_empty() {
                    load_entry(sink, &local_queue[*local_index], state, eq_config);
                    *play_started_at = Some(Instant::now());
                    *seek_offset_ms = 0;
                }
            } else {
                *local_index -= 1;
                load_entry(sink, &local_queue[*local_index], state, eq_config);
                *play_started_at = Some(Instant::now());
                *seek_offset_ms = 0;
                state.lock().unwrap().queue_index = *local_index;
            }
        }

        AudioCommand::SetShuffle(enabled) => {
            state.lock().unwrap().shuffle = enabled;
        }

        AudioCommand::SetRepeat(mode) => {
            state.lock().unwrap().repeat = mode;
        }

        AudioCommand::QueueAdd(entry) => {
            state.lock().unwrap().queue.push(entry.track_id);
            local_queue.push(entry);
        }

        AudioCommand::QueueRemove(index) => {
            if index < local_queue.len() {
                local_queue.remove(index);
                let mut s = state.lock().unwrap();
                if index < s.queue.len() {
                    s.queue.remove(index);
                }
                if *local_index > index {
                    *local_index = local_index.saturating_sub(1);
                }
            }
        }

        AudioCommand::QueueClear => {
            sink.stop();
            local_queue.clear();
            *local_index = 0;
            *play_started_at = None;
            *seek_offset_ms = 0;
            let mut s = state.lock().unwrap();
            s.queue.clear();
            s.queue_index = 0;
            s.is_playing = false;
            s.current_track_id = None;
            s.position_ms = 0;
        }
    }
}

fn load_entry(
    sink: &Sink,
    entry: &QueueEntry,
    state: &Arc<Mutex<EngineState>>,
    eq_config: &Arc<RwLock<EqConfig>>,
) {
    sink.stop();
    match File::open(&entry.path).map(BufReader::new) {
        Ok(reader) => match Decoder::new(reader) {
            Ok(decoder) => {
                let source = decoder.convert_samples::<f32>();
                let gain_eq = GainEqSource::new(source, entry.replaygain_db, Arc::clone(eq_config));
                sink.append(gain_eq);
                sink.play();
                let mut s = state.lock().unwrap();
                s.is_playing = true;
                s.current_track_id = Some(entry.track_id);
                s.duration_ms = entry.duration_ms;
                s.position_ms = 0;
            }
            Err(e) => eprintln!("Decode error {:?}: {e}", entry.path),
        },
        Err(e) => eprintln!("File open error {:?}: {e}", entry.path),
    }
}
