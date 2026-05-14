use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub cover_path: Option<String>,
    pub track_count: u32,
    pub total_duration_ms: u64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistTrack {
    pub track_id: Uuid,
    pub position: u32,
    pub added_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePlaylistRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdatePlaylistRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}
