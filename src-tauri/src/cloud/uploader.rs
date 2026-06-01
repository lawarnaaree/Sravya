use crate::adapters::db;
use crate::error::AppError;
use crate::events;
use reqwest::{multipart, Client};
use serde::Serialize;
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

static IS_SYNCING: AtomicBool = AtomicBool::new(false);

#[derive(Serialize, Clone)]
pub struct CloudUploadProgress {
    pub track_id: String,
    pub bytes_sent: u64,
    pub total_bytes: u64,
}

#[derive(Serialize, Clone)]
pub struct CloudUploadComplete {
    pub track_id: String,
}

#[derive(Serialize, Clone)]
pub struct CloudUploadFailed {
    pub track_id: String,
    pub error: String,
}

#[derive(Serialize, Clone)]
pub struct CloudSyncProgress {
    pub uploaded: u32,
    pub total: u32,
}

#[derive(Serialize, Clone)]
pub struct CloudSyncResult {
    pub uploaded: u32,
    pub skipped: u32,
    pub errors: u32,
}

pub async fn upload_track(
    app: &AppHandle,
    pool: &SqlitePool,
    api_url: &str,
    api_key: &str,
    track_id: &str,
    tracks_dir: &PathBuf,
) -> Result<(), AppError> {
    let track = match db::get_track(pool, track_id).await? {
        Some(t) => t,
        None => return Err(AppError::Other(format!("Track {} not found", track_id))),
    };

    let file_path = tracks_dir.join(format!("{}.{}", track.file_hash, track.file_ext));
    let file_bytes = tokio::fs::read(&file_path).await?;
    let total_bytes = file_bytes.len() as u64;

    let _ = app.emit(events::CLOUD_UPLOAD_PROGRESS, CloudUploadProgress {
        track_id: track_id.to_string(),
        bytes_sent: 0,
        total_bytes,
    });

    let meta_json = serde_json::json!({
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "trackNo": track.track_no,
        "durationMs": track.duration_ms,
        "codec": track.codec,
        "sampleRate": track.sample_rate,
        "bitrate": track.bitrate,
        "coverHash": track.cover_hash,
    });

    let client = Client::new();
    let file_name = format!("{}.{}", track.file_hash, track.file_ext);

    let part = multipart::Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str("audio/mpeg")
        .unwrap();

    let form = multipart::Form::new()
        .part("audio", part)
        .text("meta", meta_json.to_string());

    let resp = client
        .post(format!("{}/api/tracks", api_url))
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() || r.status().as_u16() == 200 => {
            let _ = app.emit(events::CLOUD_UPLOAD_COMPLETE, CloudUploadComplete {
                track_id: track_id.to_string(),
            });
            Ok(())
        }
        Ok(r) => {
            let err = format!("Server returned {}", r.status());
            let _ = app.emit(events::CLOUD_UPLOAD_FAILED, CloudUploadFailed {
                track_id: track_id.to_string(),
                error: err.clone(),
            });
            Err(AppError::Http(err))
        }
        Err(e) => {
            let _ = app.emit(events::CLOUD_UPLOAD_FAILED, CloudUploadFailed {
                track_id: track_id.to_string(),
                error: e.to_string(),
            });
            Err(AppError::Http(e.to_string()))
        }
    }
}

pub async fn sync_all(
    app: &AppHandle,
    pool: &SqlitePool,
    api_url: &str,
    api_key: &str,
    tracks_dir: &PathBuf,
) -> Result<CloudSyncResult, AppError> {
    if IS_SYNCING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return Ok(CloudSyncResult { uploaded: 0, skipped: 0, errors: 0 });
    }

    let _ = app.emit(events::CLOUD_SYNC_STARTED, ());

    let tracks = db::get_tracks(pool).await?;
    let total = tracks.len() as u32;
    let mut uploaded = 0u32;
    let mut skipped = 0u32;
    let mut errors = 0u32;

    for track in &tracks {
        match upload_track(app, pool, api_url, api_key, &track.id, tracks_dir).await {
            Ok(_) => uploaded += 1,
            Err(_) => errors += 1,
        }

        let _ = app.emit(events::CLOUD_SYNC_PROGRESS, CloudSyncProgress { uploaded, total });
    }

    IS_SYNCING.store(false, Ordering::SeqCst);

    Ok(CloudSyncResult { uploaded, skipped, errors })
}
