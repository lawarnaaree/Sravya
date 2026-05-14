// Tauri event names emitted from Rust → frontend.

pub const PLAYBACK_STATE_CHANGED: &str = "playback-state-changed";
pub const LIBRARY_SCAN_PROGRESS: &str = "library-scan-progress";
pub const LIBRARY_SCAN_COMPLETE: &str = "library-scan-complete";
pub const DOWNLOAD_PROGRESS: &str = "download-progress";
pub const DOWNLOAD_COMPLETE: &str = "download-complete";
pub const SYNC_PROGRESS: &str = "sync-progress";
