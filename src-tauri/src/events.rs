// Tauri event names emitted from Rust → frontend.

pub const PLAYBACK_STATE_CHANGED: &str = "playback-state-changed";
pub const LIBRARY_SCAN_PROGRESS: &str = "library-scan-progress";
pub const LIBRARY_SCAN_COMPLETE: &str = "library-scan-complete";
pub const DOWNLOAD_PROGRESS: &str = "download-progress";
pub const DOWNLOAD_COMPLETE: &str = "download-complete";
pub const DOWNLOAD_FAILED: &str = "download-failed";
pub const SYNC_PROGRESS: &str = "sync-progress";

// LAN sync events
pub const LAN_SYNC_STARTED: &str = "lan-sync-started";
pub const LAN_SYNC_PROGRESS: &str = "lan-sync-progress";
pub const LAN_SYNC_COMPLETE: &str = "lan-sync-complete";
pub const LAN_SYNC_FILE_PROGRESS: &str = "lan-sync-file-progress";
pub const LAN_DEVICE_PAIRED: &str = "lan-device-paired";
