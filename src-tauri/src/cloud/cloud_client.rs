use std::path::PathBuf;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};

use crate::adapters::db;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudTrack {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub track_no: Option<u32>,
    pub duration_ms: Option<u64>,
    pub file_hash: String,
    pub file_ext: String,
    pub codec: Option<String>,
    pub sample_rate: Option<u32>,
    pub bitrate: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChangeEntry {
    #[serde(rename = "entityType")]
    entity_type: String,
    #[serde(rename = "entityId")]
    entity_id: String,
    operation: String,
    #[serde(rename = "occurredAt")]
    occurred_at: String,
}

#[derive(Debug, Deserialize)]
struct ChangesResponse {
    changes: Vec<ChangeEntry>,
    #[serde(rename = "serverTime")]
    server_time: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PullReport {
    pub added: u32,
    pub skipped: u32,
    pub errors: u32,
}

pub struct CloudPullClient {
    pub api_url: String,
    pub api_key: String,
    pub db: SqlitePool,
    pub data_dir: PathBuf,
}

impl CloudPullClient {
    fn auth_header(&self) -> String {
        format!("Bearer {}", self.api_key)
    }

    async fn fetch_changes(&self, client: &reqwest::Client) -> anyhow::Result<ChangesResponse> {
        let last_sync = db::get_setting(&self.db, "cloud_last_pull_at")
            .await?
            .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());

        let resp = client
            .get(format!(
                "{}/api/sync/changes?since={}",
                self.api_url, last_sync
            ))
            .header("Authorization", self.auth_header())
            .send()
            .await?
            .error_for_status()?
            .json::<ChangesResponse>()
            .await?;

        Ok(resp)
    }

    async fn fetch_track_meta(
        &self,
        client: &reqwest::Client,
        track_id: &str,
    ) -> anyhow::Result<CloudTrack> {
        let track = client
            .get(format!("{}/api/tracks/{}", self.api_url, track_id))
            .header("Authorization", self.auth_header())
            .send()
            .await?
            .error_for_status()?
            .json::<CloudTrack>()
            .await?;

        Ok(track)
    }

    async fn download_file(
        &self,
        client: &reqwest::Client,
        track: &CloudTrack,
        app: &AppHandle,
    ) -> anyhow::Result<PathBuf> {
        let resp = client
            .get(format!("{}/api/tracks/{}/file", self.api_url, track.id))
            .header("Authorization", self.auth_header())
            .send()
            .await?
            .error_for_status()?;

        let total = resp.content_length().unwrap_or(0);
        let music_dir = self.data_dir.join("music");
        tokio::fs::create_dir_all(&music_dir).await?;
        let dest = music_dir.join(format!("{}.{}", track.file_hash, track.file_ext));

        let mut file = tokio::fs::File::create(&dest).await?;
        let mut downloaded: u64 = 0;
        let mut stream = resp.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let bytes = chunk?;
            use tokio::io::AsyncWriteExt;
            file.write_all(&bytes).await?;
            downloaded += bytes.len() as u64;
            let _ = app.emit(
                crate::events::CLOUD_SYNC_FILE_PROGRESS,
                serde_json::json!({
                    "hash": track.file_hash,
                    "downloaded": downloaded,
                    "total": total,
                    "progress": if total > 0 { downloaded as f32 / total as f32 } else { 0.0 },
                }),
            );
        }

        Ok(dest)
    }

    pub async fn run_pull(&self, app: &AppHandle) -> PullReport {
        let _ = app.emit(crate::events::CLOUD_SYNC_STARTED, ());

        let client = match reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                tracing::error!("cloud pull: build client: {e}");
                return PullReport {
                    added: 0,
                    skipped: 0,
                    errors: 1,
                };
            }
        };

        let changes = match self.fetch_changes(&client).await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("cloud pull: fetch_changes failed: {e}");
                let _ = app.emit(
                    crate::events::CLOUD_SYNC_COMPLETE,
                    serde_json::json!({ "error": "server_unreachable", "detail": e.to_string() }),
                );
                return PullReport {
                    added: 0,
                    skipped: 0,
                    errors: 0,
                };
            }
        };

        let server_time = changes.server_time.clone();
        let track_changes: Vec<_> = changes
            .changes
            .iter()
            .filter(|c| c.entity_type == "track" && c.operation == "upsert")
            .collect();

        let total = track_changes.len() as f32;
        let mut added = 0u32;
        let mut skipped = 0u32;
        let mut errors = 0u32;

        for (i, change) in track_changes.iter().enumerate() {
            let _ = app.emit(
                crate::events::CLOUD_SYNC_PROGRESS,
                serde_json::json!({
                    "current": i,
                    "total": total as u32,
                    "progress": if total > 0.0 { i as f32 / total } else { 1.0 },
                }),
            );

            let track = match self.fetch_track_meta(&client, &change.entity_id).await {
                Ok(t) => t,
                Err(e) => {
                    tracing::warn!("cloud pull: fetch meta {}: {e}", change.entity_id);
                    errors += 1;
                    continue;
                }
            };

            // Skip if we already have this file hash locally.
            match db::file_hash_exists(&self.db, &track.file_hash).await {
                Ok(true) => {
                    skipped += 1;
                    continue;
                }
                Ok(false) => {}
                Err(e) => {
                    tracing::warn!("DB check: {e}");
                    errors += 1;
                    continue;
                }
            }

            let dest = match self.download_file(&client, &track, app).await {
                Ok(p) => p,
                Err(e) => {
                    tracing::warn!("cloud pull: download {}: {e}", track.file_hash);
                    errors += 1;
                    continue;
                }
            };

            // Insert into local DB using existing artist/album upsert pattern.
            let artist = track.artist.as_deref().unwrap_or("Unknown Artist");
            let album = track.album.as_deref().unwrap_or("Unknown Album");

            let artist_id = match db::upsert_artist(&self.db, artist).await {
                Ok(id) => id,
                Err(e) => {
                    tracing::warn!("upsert artist: {e}");
                    errors += 1;
                    continue;
                }
            };
            let album_id = match db::upsert_album(&self.db, album, artist_id, None).await {
                Ok(id) => id,
                Err(e) => {
                    tracing::warn!("upsert album: {e}");
                    errors += 1;
                    continue;
                }
            };

            let insert = db::TrackInsert {
                title: track.title.clone(),
                album_id,
                artist_id,
                track_no: track.track_no,
                disc_no: None,
                duration_ms: track.duration_ms.unwrap_or(0),
                file_path: dest.to_string_lossy().to_string(),
                file_hash: track.file_hash.clone(),
                codec: track.codec.clone().unwrap_or_default(),
                bit_depth: None,
                sample_rate: track.sample_rate,
                bitrate: track.bitrate,
                cover_path: None,
            };

            if let Err(e) = db::upsert_track(&self.db, &insert).await {
                tracing::warn!("DB insert: {e}");
                errors += 1;
                continue;
            }

            added += 1;
        }

        let _ = db::set_setting(&self.db, "cloud_last_pull_at", &server_time).await;
        let _ = app.emit(
            crate::events::CLOUD_SYNC_COMPLETE,
            serde_json::json!({ "added": added, "skipped": skipped, "errors": errors }),
        );

        PullReport {
            added,
            skipped,
            errors,
        }
    }
}
