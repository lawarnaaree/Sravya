use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChangeEntry {
    pub seq: i64,
    pub entity_type: String,
    pub entity_id: String,
    pub operation: String,
    pub occurred_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChangesResponse {
    pub changes: Vec<ChangeEntry>,
    /// ISO8601 timestamp from the server; iOS stores this as the new last_sync_timestamp.
    pub server_time: String,
}

#[derive(Debug, Serialize)]
pub struct PairingBeginResponse {
    pub challenge: String,
    pub server_name: String,
}

#[derive(Debug, Deserialize)]
pub struct PairingConfirmRequest {
    pub device_name: String,
    pub device_pubkey: String,
    pub challenge_sig: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct PairedDevice {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub paired_at: String,
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LanServerInfo {
    pub address: String,
    pub port: u16,
    pub server_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveredServer {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub address: String,
}

#[derive(Debug, Serialize)]
pub struct LanSyncStatus {
    pub phase: String,
    pub progress: f32,
    pub last_synced_at: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SyncReport {
    pub added: u32,
    pub skipped: u32,
    pub errors: u32,
}
