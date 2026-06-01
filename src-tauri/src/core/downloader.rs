use crate::adapters::db::{self, TrackRow};
use crate::error::AppError;
use crate::events;
use serde::Serialize;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Serialize, Clone)]
pub struct DownloadProgress {
    pub track_id: String,
    pub percent: u8,
    pub speed_kbps: u32,
}

#[derive(Serialize, Clone)]
pub struct DownloadComplete {
    pub track_id: String,
}

#[derive(Serialize, Clone)]
pub struct DownloadFailed {
    pub track_id: String,
    pub error: String,
}

pub async fn import_url(
    app: &AppHandle,
    pool: &SqlitePool,
    url: &str,
    output_dir: &Path,
    ytdlp_path: &str,
) -> Result<String, AppError> {
    let track_id = Uuid::new_v4().to_string();
    let out_template = output_dir.join(format!("{}.%(ext)s", track_id));

    let _ = app.emit(events::DOWNLOAD_PROGRESS, DownloadProgress {
        track_id: track_id.clone(),
        percent: 0,
        speed_kbps: 0,
    });

    let status = tokio::process::Command::new(ytdlp_path)
        .args([
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "--no-playlist",
            "-o", out_template.to_str().unwrap_or(""),
            url,
        ])
        .status()
        .await
        .map_err(|e| AppError::ImportRefused(format!("yt-dlp failed to start: {e}")))?;

    if !status.success() {
        let _ = app.emit(events::DOWNLOAD_FAILED, DownloadFailed {
            track_id: track_id.clone(),
            error: "yt-dlp returned non-zero exit code".into(),
        });
        return Err(AppError::ImportRefused("yt-dlp download failed".into()));
    }

    let final_path = output_dir.join(format!("{}.mp3", track_id));

    if !final_path.exists() {
        let err = "Downloaded file not found".to_string();
        let _ = app.emit(events::DOWNLOAD_FAILED, DownloadFailed { track_id: track_id.clone(), error: err.clone() });
        return Err(AppError::Io(err));
    }

    let track = match crate::adapters::tagger::read_tags(&final_path) {
        Ok(mut t) => { t.id = track_id.clone(); t }
        Err(_) => TrackRow {
            id: track_id.clone(),
            title: url.to_string(),
            artist: None,
            album: None,
            track_no: None,
            duration_ms: None,
            file_hash: track_id.clone(),
            file_ext: "mp3".into(),
            file_path: final_path.to_string_lossy().to_string(),
            cover_hash: None,
            codec: None,
            sample_rate: None,
            bitrate: None,
            added_at: chrono::Utc::now().to_rfc3339(),
        },
    };

    db::upsert_track(pool, &track).await?;
    db::log_change(pool, "track", &track_id, "upsert").await?;

    let _ = app.emit(events::DOWNLOAD_COMPLETE, DownloadComplete { track_id: track_id.clone() });
    let _ = app.emit(events::LIBRARY_UPDATED, ());

    Ok(track_id)
}
