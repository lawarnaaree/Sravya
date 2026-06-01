use crate::adapters::db::{self, TrackRow};
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
}

#[derive(Deserialize)]
struct ChangeEntry {
    #[serde(rename = "entityId")]
    entity_id: String,
    operation: String,
}

#[derive(Serialize, Clone)]
pub struct LanSyncFileProgress {
    pub track_id: String,
    pub title: String,
    pub bytes_received: u64,
    pub total_bytes: u64,
}

#[derive(Serialize, Clone)]
pub struct LanSyncResult {
    pub synced: u32,
    pub skipped: u32,
    pub errors: u32,
}

pub async fn run_sync(
    app: &AppHandle,
    pool: &SqlitePool,
    server_url: &str,
    hmac_key: &[u8],
    tracks_dir: &PathBuf,
    last_synced_at: Option<&str>,
) -> Result<LanSyncResult, AppError> {
    let client = Client::new();
    let ts = chrono::Utc::now().timestamp() as u64;
    let sig = crate::crypto::auth::sign(ts, "GET", "/sync/changes", hmac_key);

    let url = if let Some(since) = last_synced_at {
        format!("{}/sync/changes?since={}", server_url, urlencoding::encode(since))
    } else {
        format!("{}/sync/changes", server_url)
    };

    let resp = client
        .get(&url)
        .header("X-Timestamp", ts.to_string())
        .header("X-Signature", &sig)
        .send()
        .await?
        .json::<ChangesResponse>()
        .await?;

    let mut synced = 0u32;
    let mut skipped = 0u32;
    let mut errors = 0u32;

    let local_tracks = db::get_tracks(pool).await?;

    for change in resp.changes {
        if change.operation == "delete" {
            continue;
        }

        if local_tracks.iter().any(|t| t.id == change.entity_id) {
            skipped += 1;
            continue;
        }

        let ts2 = chrono::Utc::now().timestamp() as u64;
        let sig2 = crate::crypto::auth::sign(ts2, "GET", &format!("/tracks/{}", change.entity_id), hmac_key);

        let meta_resp = client
            .get(&format!("{}/tracks/{}", server_url, change.entity_id))
            .header("X-Timestamp", ts2.to_string())
            .header("X-Signature", &sig2)
            .send()
            .await;

        match meta_resp {
            Ok(r) if r.status().is_success() => {
                match r.json::<TrackRow>().await {
                    Ok(track) => {
                        if local_tracks.iter().any(|t| t.file_hash == track.file_hash) {
                            skipped += 1;
                            continue;
                        }

                        let ts3 = chrono::Utc::now().timestamp() as u64;
                        let path_str = format!("/tracks/{}/file", track.id);
                        let sig3 = crate::crypto::auth::sign(ts3, "GET", &path_str, hmac_key);

                        let file_resp = client
                            .get(&format!("{}{}", server_url, path_str))
                            .header("X-Timestamp", ts3.to_string())
                            .header("X-Signature", &sig3)
                            .send()
                            .await;

                        match file_resp {
                            Ok(fr) if fr.status().is_success() => {
                                let file_path = tracks_dir.join(format!("{}.{}", track.file_hash, track.file_ext));
                                let bytes = fr.bytes().await.unwrap_or_default();
                                if tokio::fs::write(&file_path, &bytes).await.is_ok() {
                                    let _ = db::upsert_track(pool, &track).await;
                                    let _ = app.emit(events::LAN_SYNC_FILE_PROGRESS, LanSyncFileProgress {
                                        track_id: track.id.clone(),
                                        title: track.title.clone(),
                                        bytes_received: bytes.len() as u64,
                                        total_bytes: bytes.len() as u64,
                                    });
                                    synced += 1;
                                } else {
                                    errors += 1;
                                }
                            }
                            _ => errors += 1,
                        }
                    }
                    Err(_) => errors += 1,
                }
            }
            _ => errors += 1,
        }
    }

    Ok(LanSyncResult { synced, skipped, errors })
}
