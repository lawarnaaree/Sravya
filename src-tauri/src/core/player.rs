use crate::error::AppError;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RepeatMode {
    Off,
    One,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerState {
    pub is_playing: bool,
    pub current_track_id: Option<String>,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub volume: f32,
    pub repeat: RepeatMode,
    pub shuffle: bool,
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            is_playing: false,
            current_track_id: None,
            position_ms: 0,
            duration_ms: 0,
            volume: 1.0,
            repeat: RepeatMode::Off,
            shuffle: false,
        }
    }
}

// OutputStream is !Send+!Sync, so we keep it on a dedicated thread and only
// expose Sink (which is Send+Sync) through Player.
pub struct Player {
    sink: Arc<Mutex<Sink>>,
    state: Arc<Mutex<PlayerState>>,
    current_path: Arc<Mutex<Option<PathBuf>>>,
    // Keeps the audio thread alive for the lifetime of Player.
    _thread: std::thread::JoinHandle<()>,
}

unsafe impl Send for Player {}
unsafe impl Sync for Player {}

impl Player {
    pub fn new() -> Result<Self, AppError> {
        let (tx, rx) = std::sync::mpsc::sync_channel::<Result<(OutputStreamHandle, Sink), String>>(1);

        let thread = std::thread::spawn(move || {
            match OutputStream::try_default() {
                Ok((_stream, handle)) => match Sink::try_new(&handle) {
                    Ok(sink) => {
                        let _ = tx.send(Ok((handle, sink)));
                        // Keep _stream alive on this thread.
                        std::thread::park();
                    }
                    Err(e) => { let _ = tx.send(Err(e.to_string())); }
                },
                Err(e) => { let _ = tx.send(Err(e.to_string())); }
            }
        });

        let (_handle, sink) = rx.recv()
            .map_err(|_| AppError::Audio("audio thread died".into()))?
            .map_err(AppError::Audio)?;

        Ok(Self {
            sink: Arc::new(Mutex::new(sink)),
            state: Arc::new(Mutex::new(PlayerState::default())),
            current_path: Arc::new(Mutex::new(None)),
            _thread: thread,
        })
    }

    pub fn play(&self, path: &PathBuf, track_id: &str, duration_ms: u64) -> Result<(), AppError> {
        let file = File::open(path)?;
        let source = Decoder::new(BufReader::new(file))
            .map_err(|e| AppError::Audio(e.to_string()))?;

        let sink = self.sink.lock().unwrap();
        sink.clear();
        sink.append(source);
        sink.play();

        let mut state = self.state.lock().unwrap();
        state.is_playing = true;
        state.current_track_id = Some(track_id.to_string());
        state.position_ms = 0;
        state.duration_ms = duration_ms;

        *self.current_path.lock().unwrap() = Some(path.clone());
        Ok(())
    }

    pub fn pause(&self) {
        self.sink.lock().unwrap().pause();
        self.state.lock().unwrap().is_playing = false;
    }

    pub fn resume(&self) {
        self.sink.lock().unwrap().play();
        self.state.lock().unwrap().is_playing = true;
    }

    pub fn stop(&self) {
        self.sink.lock().unwrap().clear();
        let mut state = self.state.lock().unwrap();
        state.is_playing = false;
        state.position_ms = 0;
    }

    pub fn set_volume(&self, vol: f32) {
        self.sink.lock().unwrap().set_volume(vol);
        self.state.lock().unwrap().volume = vol;
    }

    pub fn get_state(&self) -> PlayerState {
        self.state.lock().unwrap().clone()
    }

    pub fn set_repeat(&self, mode: RepeatMode) {
        self.state.lock().unwrap().repeat = mode;
    }

    pub fn set_shuffle(&self, shuffle: bool) {
        self.state.lock().unwrap().shuffle = shuffle;
    }
}
