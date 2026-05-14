use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharePayload {
    pub playlist_id: Uuid,
    pub playlist_name: String,
    pub tracks: Vec<SharedTrack>,
    pub sender_pubkey: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedTrack {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub isrc: Option<String>,
    pub mbid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareFileHeader {
    pub version: u8,
    pub sender_pubkey: String,
    pub recipient_pubkey: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum ImportShareResult {
    Success {
        playlist_name: String,
        matched: u32,
        unmatched: Vec<SharedTrack>,
    },
    SignatureInvalid,
    DecryptionFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityInfo {
    pub public_key: String,
    pub fingerprint: String,
}
