use crate::core::library::Track;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PlaybackState {
    Stopped,
    Playing,
    Paused,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RepeatMode {
    Off,
    One,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackStatus {
    pub state: PlaybackState,
    pub current_track: Option<Track>,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub volume: f32,
    pub muted: bool,
    pub shuffle: bool,
    pub repeat: RepeatMode,
    pub queue: Vec<Uuid>,
    pub queue_index: usize,
}

impl Default for PlaybackStatus {
    fn default() -> Self {
        Self {
            state: PlaybackState::Stopped,
            current_track: None,
            position_ms: 0,
            duration_ms: 0,
            volume: 1.0,
            muted: false,
            shuffle: false,
            repeat: RepeatMode::Off,
            queue: Vec::new(),
            queue_index: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum PlayerCommand {
    Play {
        track_id: Uuid,
    },
    PlayQueue {
        track_ids: Vec<Uuid>,
        start_index: usize,
    },
    Pause,
    Resume,
    Stop,
    Seek {
        position_ms: u64,
    },
    SetVolume {
        level: f32,
    },
    Mute,
    Unmute,
    Next,
    Previous,
    SetShuffle {
        enabled: bool,
    },
    SetRepeat {
        mode: RepeatMode,
    },
    QueueAdd {
        track_id: Uuid,
    },
    QueueRemove {
        index: usize,
    },
    QueueMove {
        from: usize,
        to: usize,
    },
    QueueClear,
}
