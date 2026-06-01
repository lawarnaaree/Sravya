use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use reqwest::multipart;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::adapters::db;

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadReport {
    pub uploaded: u32,
    pub skipped: u32,
    pub errors: u32,
}

static SYNC_RUNNING: AtomicBool = AtomicBool::new(false);

fn make_client() -> reqwest::Result<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
}

/// Upload a single track by ID. Skips if the server already has this file hash.
pub async fn upload_track(
    db: &SqlitePool,
    _covers_dir: &Path,
    api_url: &str,
    api_key: &str,
    track_id: Uuid,
    app: &AppHandle,
) -> anyhow::Result<bool> {
    let track = db::get_track_by_id(db, track_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Track not found"))?;

    let client = make_client()?;
    let auth = format!("Bearer {}", api_key);

    // Check if server already has this hash via tracks list (lightweight: just try uploading —
    // server returns duplicate:true if hash exists, so no extra round-trip needed).

    let audio_path = Path::new(&track.file_path);
    let ext = audio_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp3")
        .to_lowercase();

    if !audio_path.exists() {
        return Err(anyhow::anyhow!("Audio file not found: {}", track.file_path));
    }

    let file_bytes = tokio::fs::read(audio_path).await?;
    let total = file_bytes.len() as u64;

    let _ = app.emit(
        crate::events::CLOUD_UPLOAD_PROGRESS,
        serde_json::json!({
            "trackId": track.id,
            "bytesSent": 0,
            "totalBytes": total,
            "progress": 0.0,
        }),
    );

    // Build metadata JSON — mirrors the server's expected `meta` field
    let meta = serde_json::json!({
        "id": track.id,
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "track_no": track.track_no,
        "duration_ms": track.duration_ms,
        "file_ext": ext,
        "codec": track.codec,
        "sample_rate": track.sample_rate,
        "bitrate": track.bitrate,
        "cover_hash": null, // uploaded separately below
    });

    let mime = match ext.as_str() {
        "mp3" => "audio/mpeg",
        "m4a" | "aac" => "audio/mp4",
        "flac" => "audio/flac",
        "ogg" | "opus" => "audio/ogg",
        "wav" => "audio/wav",
        "aiff" | "aif" => "audio/aiff",
        _ => "application/octet-stream",
    };

    let file_part = multipart::Part::bytes(file_bytes)
        .file_name(format!("{}.{}", track.file_hash, ext))
        .mime_str(mime)?;

    let form = multipart::Form::new()
        .text("meta", meta.to_string())
        .part("audio", file_part);

    let resp = client
        .post(format!("{}/api/tracks", api_url))
        .header("Authorization", &auth)
        .multipart(form)
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;

    let _ = app.emit(
        crate::events::CLOUD_UPLOAD_PROGRESS,
        serde_json::json!({
            "trackId": track.id,
            "bytesSent": total,
            "totalBytes": total,
            "progress": 1.0,
        }),
    );

    // Upload cover art if present
    if let Some(ref cover_path) = track.cover_path {
        let cp = Path::new(cover_path);
        if cp.exists() {
            upload_cover(&client, api_url, &auth, cp).await.ok();
        }
    }

    let is_duplicate = resp
        .get("duplicate")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let _ = app.emit(
        crate::events::CLOUD_UPLOAD_COMPLETE,
        serde_json::json!({ "trackId": track.id }),
    );

    Ok(!is_duplicate)
}

async fn upload_cover(
    client: &reqwest::Client,
    api_url: &str,
    auth: &str,
    cover_path: &Path,
) -> anyhow::Result<()> {
    let ext = cover_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let bytes = tokio::fs::read(cover_path).await?;
    let mime = if ext == "png" {
        "image/png"
    } else {
        "image/jpeg"
    };

    let part = multipart::Part::bytes(bytes)
        .file_name(format!("cover.{}", ext))
        .mime_str(mime)?;
    let form = multipart::Form::new().part("cover", part);

    client
        .post(format!("{}/api/covers", api_url))
        .header("Authorization", auth)
        .multipart(form)
        .send()
        .await?
        .error_for_status()?;

    Ok(())
}

/// Sync all tracks to the cloud. Skips already-uploaded hashes tracked in settings.
pub async fn sync_all(
    db: &SqlitePool,
    covers_dir: &std::path::PathBuf,
    api_url: &str,
    api_key: &str,
    app: &AppHandle,
) -> UploadReport {
    if SYNC_RUNNING.swap(true, Ordering::SeqCst) {
        return UploadReport {
            uploaded: 0,
            skipped: 0,
            errors: 0,
        };
    }

    let _ = app.emit(crate::events::CLOUD_SYNC_STARTED, ());

    let tracks = match db::get_tracks(db, 10000, 0).await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("cloud sync_all: failed to list tracks: {e}");
            SYNC_RUNNING.store(false, Ordering::SeqCst);
            return UploadReport {
                uploaded: 0,
                skipped: 0,
                errors: 1,
            };
        }
    };

    let total = tracks.len() as u32;
    let mut uploaded = 0u32;
    let mut skipped = 0u32;
    let mut errors = 0u32;

    for (i, track) in tracks.iter().enumerate() {
        let _ = app.emit(
            crate::events::CLOUD_SYNC_PROGRESS,
            serde_json::json!({
                "current": i,
                "total": total,
                "progress": if total > 0 { i as f32 / total as f32 } else { 1.0 },
            }),
        );

        let id = track.id;

        match upload_track(db, covers_dir, api_url, api_key, id, app).await {
            Ok(true) => uploaded += 1,
            Ok(false) => skipped += 1,
            Err(e) => {
                tracing::warn!("cloud upload track {}: {e}", track.id);
                let _ = app.emit(
                    crate::events::CLOUD_UPLOAD_FAILED,
                    serde_json::json!({ "trackId": track.id, "error": e.to_string() }),
                );
                errors += 1;
            }
        }
    }

    let now = chrono::Utc::now().to_rfc3339();
    let _ = db::set_setting(db, "cloud_last_synced_at", &now).await;

    let _ = app.emit(
        crate::events::CLOUD_SYNC_COMPLETE,
        serde_json::json!({ "uploaded": uploaded, "skipped": skipped, "errors": errors }),
    );

    SYNC_RUNNING.store(false, Ordering::SeqCst);

    UploadReport {
        uploaded,
        skipped,
        errors,
    }
}
