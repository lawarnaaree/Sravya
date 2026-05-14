use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SyncProvider {
    Spotify,
    YouTube,
    AppleMusic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPlaylist {
    pub provider: SyncProvider,
    pub provider_id: String,
    pub name: String,
    pub description: Option<String>,
    pub track_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderTrack {
    pub provider_id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub isrc: Option<String>,
    pub local_match: Option<Uuid>,
    pub match_confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub provider: SyncProvider,
    pub connected: bool,
    pub last_synced_at: Option<chrono::DateTime<chrono::Utc>>,
    pub playlist_count: u32,
}
