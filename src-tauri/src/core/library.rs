use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: Uuid,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_artist: Option<String>,
    pub track_no: Option<u32>,
    pub disc_no: Option<u32>,
    pub duration_ms: u64,
    pub year: Option<i32>,
    pub file_path: String,
    pub file_hash: String,
    pub codec: String,
    pub bit_depth: Option<u32>,
    pub sample_rate: Option<u32>,
    pub bitrate: Option<u32>,
    pub isrc: Option<String>,
    pub mbid: Option<String>,
    pub cover_path: Option<String>,
    pub replaygain_track: Option<f32>,
    pub replaygain_album: Option<f32>,
    pub play_count: u64,
    pub last_played_at: Option<DateTime<Utc>>,
    pub added_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub id: Uuid,
    pub title: String,
    pub artist: String,
    pub year: Option<i32>,
    pub mbid: Option<String>,
    pub cover_path: Option<String>,
    pub track_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artist {
    pub id: Uuid,
    pub name: String,
    pub sort_name: Option<String>,
    pub mbid: Option<String>,
    pub album_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryStats {
    pub track_count: u64,
    pub album_count: u64,
    pub artist_count: u64,
    pub total_duration_ms: u64,
    pub watched_folders: Vec<String>,
}
