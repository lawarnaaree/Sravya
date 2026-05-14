use std::{
    fs::File,
    io::BufReader,
    path::PathBuf,
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

use rodio::{Decoder, OutputStream, Sink};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
}

pub enum AudioCommand {
    Play {
        path: PathBuf,
        track_id: Uuid,
        duration_ms: u64,
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
}

impl AudioEngine {
    pub fn new() -> Self {
        let (tx, rx) = std::sync::mpsc::sync_channel::<AudioCommand>(64);
        let state = Arc::new(Mutex::new(EngineState::default()));
        let state_clone = Arc::clone(&state);

        thread::spawn(move || run_audio_loop(rx, state_clone));

        Self {
            command_tx: tx,
            state,
        }
    }

    pub fn send(&self, cmd: AudioCommand) {
        let _ = self.command_tx.try_send(cmd);
    }

    pub fn get_state(&self) -> EngineState {
        self.state.lock().unwrap().clone()
    }
}

fn run_audio_loop(rx: std::sync::mpsc::Receiver<AudioCommand>, state: Arc<Mutex<EngineState>>) {
    let (_stream, stream_handle) = match OutputStream::try_default() {
        Ok(pair) => pair,
        Err(e) => {
            eprintln!("Audio device error: {e}");
            return;
        }
    };

    let sink = Arc::new(Sink::try_new(&stream_handle).expect("failed to create sink"));
    sink.set_volume(0.8);

    let mut local_queue: Vec<QueueEntry> = Vec::new();
    let mut local_index: usize = 0;
    // Manual position tracking: when we start playing, record the instant and seek_offset.
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
                    load_entry(&sink, &local_queue[next_index], &state);
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

        // Update position from our manual timer.
        {
            let mut s = state.lock().unwrap();
            if s.is_playing && !sink.is_paused() {
                if let Some(started) = play_started_at {
                    let elapsed_ms = started.elapsed().as_millis() as u64;
                    let pos = (seek_offset_ms + elapsed_ms).min(s.duration_ms);
                    s.position_ms = pos;
                }
            }
        }

        thread::sleep(tick);
    }
}

fn handle_command(
    cmd: AudioCommand,
    sink: &Arc<Sink>,
    state: &Arc<Mutex<EngineState>>,
    local_queue: &mut Vec<QueueEntry>,
    local_index: &mut usize,
    play_started_at: &mut Option<Instant>,
    seek_offset_ms: &mut u64,
) {
    match cmd {
        AudioCommand::Play {
            path,
            track_id,
            duration_ms,
        } => {
            local_queue.clear();
            *local_index = 0;
            let entry = QueueEntry {
                track_id,
                path,
                duration_ms,
            };
            load_entry(sink, &entry, state);
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
                load_entry(sink, &entries[*local_index], state);
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
            // Freeze the position counter.
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
            // rodio 0.17 has no seek; restart from beginning as best-effort.
            // Phase 2 will implement proper seeking via symphonia.
            if !local_queue.is_empty() {
                load_entry(sink, &local_queue[*local_index], state);
                *seek_offset_ms = 0;
                *play_started_at = Some(Instant::now());
            }
            let _ = ms; // unused until Phase 2 seek
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
                load_entry(sink, &local_queue[*local_index], state);
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
                // Restart current track.
                if !local_queue.is_empty() {
                    load_entry(sink, &local_queue[*local_index], state);
                    *play_started_at = Some(Instant::now());
                    *seek_offset_ms = 0;
                }
            } else {
                *local_index -= 1;
                load_entry(sink, &local_queue[*local_index], state);
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

fn load_entry(sink: &Sink, entry: &QueueEntry, state: &Arc<Mutex<EngineState>>) {
    sink.stop();
    match File::open(&entry.path).and_then(|f| Ok(BufReader::new(f))) {
        Ok(reader) => match Decoder::new(reader) {
            Ok(source) => {
                sink.append(source);
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
