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

// Cloud sync events (desktop upload + mobile pull)
pub const CLOUD_UPLOAD_PROGRESS: &str = "cloud-upload-progress";
pub const CLOUD_UPLOAD_COMPLETE: &str = "cloud-upload-complete";
pub const CLOUD_UPLOAD_FAILED: &str = "cloud-upload-failed";
pub const CLOUD_SYNC_STARTED: &str = "cloud-sync-started";
pub const CLOUD_SYNC_PROGRESS: &str = "cloud-sync-progress";
pub const CLOUD_SYNC_COMPLETE: &str = "cloud-sync-complete";
pub const CLOUD_SYNC_FILE_PROGRESS: &str = "cloud-sync-file-progress";
