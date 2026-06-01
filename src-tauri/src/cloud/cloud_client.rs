use crate::adapters::db;
use crate::error::AppError;
use crate::events;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

#[derive(Deserialize)]
struct ChangesResponse {
    changes: Vec<ChangeEntry>,
    #[serde(rename = "serverTime")]
    server_time: String,
}

#[derive(Deserialize)]
struct ChangeEntry {
    #[serde(rename = "entityId")]
    entity_id: String,
    #[serde(rename = "entityType")]
    entity_type: String,
    operation: String,
}

#[derive(Deserialize)]
struct TrackMeta {
    id: String,
    title: String,
    artist: Option<String>,
    album: Option<String>,
    track_no: Option<i64>,
    duration_ms: Option<i64>,
    file_hash: String,
    file_ext: String,
    cover_hash: Option<String>,
    codec: Option<String>,
    sample_rate: Option<i64>,
    bitrate: Option<i64>,
}

#[derive(Serialize, Clone)]
pub struct CloudSyncFileProgress {
    pub track_id: String,
    pub bytes_received: u64,
    pub total_bytes: u64,
}

#[derive(Serialize, Clone)]
pub struct CloudPullResult {
    pub pulled: u32,
    pub skipped: u32,
    pub errors: u32,
    pub server_time: String,
}

pub async fn run_pull(
    app: &AppHandle,
    pool: &SqlitePool,
    api_url: &str,
    api_key: &str,
    tracks_dir: &PathBuf,
    last_pull_at: Option<&str>,
) -> Result<CloudPullResult, AppError> {
    let client = Client::new();

    let url = if let Some(since) = last_pull_at {
        format!("{}/api/sync/changes?since={}", api_url, urlencoding::encode(since))
    } else {
        format!("{}/api/sync/changes", api_url)
    };

    let resp = client
        .get(&url)
        .bearer_auth(api_key)
        .send()
        .await?
        .json::<ChangesResponse>()
        .await?;

    let server_time = resp.server_time.clone();
    let local_tracks = db::get_tracks(pool).await?;
    let mut pulled = 0u32;
    let mut skipped = 0u32;
    let mut errors = 0u32;

    for change in resp.changes {
        if change.entity_type != "track" || change.operation != "upsert" {
            continue;
        }

        let meta: TrackMeta = match client
            .get(&format!("{}/api/tracks/{}", api_url, change.entity_id))
            .bearer_auth(api_key)
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => match r.json().await {
                Ok(m) => m,
                Err(_) => { errors += 1; continue; }
            },
            _ => { errors += 1; continue; }
        };

        if local_tracks.iter().any(|t| t.file_hash == meta.file_hash) {
            skipped += 1;
            continue;
        }

        let file_resp = match client
            .get(&format!("{}/api/tracks/{}/file", api_url, meta.id))
            .bearer_auth(api_key)
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => r,
            _ => { errors += 1; continue; }
        };

        let total_bytes = file_resp.content_length().unwrap_or(0);
        let bytes = match file_resp.bytes().await {
            Ok(b) => b,
            Err(_) => { errors += 1; continue; }
        };

        let file_path = tracks_dir.join(format!("{}.{}", meta.file_hash, meta.file_ext));
        if tokio::fs::write(&file_path, &bytes).await.is_err() {
            errors += 1;
            continue;
        }

        let track_row = db::TrackRow {
            id: meta.id.clone(),
            title: meta.title,
            artist: meta.artist,
            album: meta.album,
            track_no: meta.track_no,
            duration_ms: meta.duration_ms,
            file_hash: meta.file_hash,
            file_ext: meta.file_ext,
            file_path: file_path.to_string_lossy().to_string(),
            cover_hash: meta.cover_hash,
            codec: meta.codec,
            sample_rate: meta.sample_rate,
            bitrate: meta.bitrate,
            added_at: chrono::Utc::now().to_rfc3339(),
        };

        let _ = db::upsert_track(pool, &track_row).await;

        let _ = app.emit(events::CLOUD_SYNC_FILE_PROGRESS, CloudSyncFileProgress {
            track_id: meta.id.clone(),
            bytes_received: bytes.len() as u64,
            total_bytes: total_bytes.max(bytes.len() as u64),
        });

        pulled += 1;
    }

    Ok(CloudPullResult { pulled, skipped, errors, server_time })
}
