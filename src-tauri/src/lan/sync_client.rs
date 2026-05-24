use std::path::{Path, PathBuf};

use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};

use crate::{
    adapters::db,
    lan::{auth::sign_request, protocol::*},
};

pub struct SyncClient {
    pub server_url: String,
    pub device_id: String,
    /// HMAC key = SHA256(device Ed25519 public key bytes).
    pub hmac_key: Vec<u8>,
    pub db: SqlitePool,
    pub data_dir: PathBuf,
}

impl SyncClient {
    fn auth_headers(&self, method: &str, path: &str) -> HeaderMap {
        let timestamp = chrono::Utc::now().timestamp() as u64;
        let sig = sign_request(method, path, timestamp, &self.hmac_key);
        let mut headers = HeaderMap::new();
        headers.insert(
            HeaderName::from_static("x-sravya-device-id"),
            HeaderValue::from_str(&self.device_id).unwrap(),
        );
        headers.insert(
            HeaderName::from_static("x-sravya-timestamp"),
            HeaderValue::from_str(&timestamp.to_string()).unwrap(),
        );
        headers.insert(
            HeaderName::from_static("x-sravya-signature"),
            HeaderValue::from_str(&sig).unwrap(),
        );
        headers
    }

    async fn fetch_changes(&self, client: &reqwest::Client) -> anyhow::Result<ChangesResponse> {
        let last_sync = db::get_setting(&self.db, "last_sync_timestamp")
            .await?
            .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());

        let base_path = "/sync/changes";
        let url = format!("{}{}?since={}", self.server_url, base_path, last_sync);
        let headers = self.auth_headers("GET", base_path);

        Ok(client
            .get(&url)
            .headers(headers)
            .send()
            .await?
            .error_for_status()?
            .json::<ChangesResponse>()
            .await?)
    }

    async fn download_file(
        &self,
        client: &reqwest::Client,
        hash: &str,
        ext: &str,
        app: &AppHandle,
    ) -> anyhow::Result<PathBuf> {
        let base_path = format!("/files/{}", hash);
        let url = format!("{}{}", self.server_url, base_path);
        let headers = self.auth_headers("GET", &base_path);

        let resp = client
            .get(&url)
            .headers(headers)
            .send()
            .await?
            .error_for_status()?;

        let total = resp.content_length().unwrap_or(0);

        let music_dir = self.data_dir.join("music");
        tokio::fs::create_dir_all(&music_dir).await?;
        let dest = music_dir.join(format!("{}.{}", hash, ext));

        let mut file = tokio::fs::File::create(&dest).await?;
        let mut downloaded: u64 = 0;
        let mut stream = resp.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let bytes = chunk?;
            use tokio::io::AsyncWriteExt;
            file.write_all(&bytes).await?;
            downloaded += bytes.len() as u64;
            let _ = app.emit(
                crate::events::LAN_SYNC_FILE_PROGRESS,
                serde_json::json!({
                    "hash": hash,
                    "downloaded": downloaded,
                    "total": total,
                    "progress": if total > 0 { downloaded as f32 / total as f32 } else { 0.0 },
                }),
            );
        }

        Ok(dest)
    }

    pub async fn run_sync(&self, app: &AppHandle) -> SyncReport {
        let _ = app.emit(crate::events::LAN_SYNC_STARTED, ());
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        let changes = match self.fetch_changes(&client).await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("LAN sync: fetch_changes failed: {e}");
                let _ = app.emit(
                    crate::events::LAN_SYNC_COMPLETE,
                    serde_json::json!({ "error": "server_unreachable" }),
                );
                return SyncReport {
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
                crate::events::LAN_SYNC_PROGRESS,
                serde_json::json!({
                    "current": i,
                    "total": total as u32,
                    "progress": if total > 0.0 { i as f32 / total } else { 1.0 },
                }),
            );

            // Fetch track metadata from server.
            let meta_path = format!("/library/tracks/{}", change.entity_id);
            let meta_url = format!("{}{}", self.server_url, meta_path);
            let headers = self.auth_headers("GET", &meta_path);
            let track: crate::core::library::Track = match client
                .get(&meta_url)
                .headers(headers)
                .send()
                .await
                .and_then(|r| r.error_for_status())
            {
                Ok(resp) => match resp.json().await {
                    Ok(t) => t,
                    Err(e) => {
                        tracing::warn!("parse track {}: {e}", change.entity_id);
                        errors += 1;
                        continue;
                    }
                },
                Err(e) => {
                    tracing::warn!("fetch track {}: {e}", change.entity_id);
                    errors += 1;
                    continue;
                }
            };

            // Skip if we already have this file.
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

            // Determine extension from original file path.
            let ext = Path::new(&track.file_path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("bin")
                .to_string();

            let dest = match self
                .download_file(&client, &track.file_hash, &ext, app)
                .await
            {
                Ok(p) => p,
                Err(e) => {
                    tracing::warn!("download {}: {e}", track.file_hash);
                    errors += 1;
                    continue;
                }
            };

            // Insert into local DB.
            let artist_id = match db::upsert_artist(&self.db, &track.artist).await {
                Ok(id) => id,
                Err(e) => {
                    tracing::warn!("upsert artist: {e}");
                    errors += 1;
                    continue;
                }
            };
            let album_id =
                match db::upsert_album(&self.db, &track.album, artist_id, track.year).await {
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
                disc_no: track.disc_no,
                duration_ms: track.duration_ms,
                file_path: dest.to_string_lossy().to_string(),
                file_hash: track.file_hash.clone(),
                codec: track.codec.clone(),
                bit_depth: track.bit_depth,
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

        let _ = db::set_setting(&self.db, "last_sync_timestamp", &server_time).await;
        let _ = app.emit(
            crate::events::LAN_SYNC_COMPLETE,
            serde_json::json!({ "added": added, "skipped": skipped, "errors": errors }),
        );

        SyncReport {
            added,
            skipped,
            errors,
        }
    }
}
