use std::{path::PathBuf, sync::Arc};

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::{
    adapters::{
        audio::{AudioCommand, QueueEntry},
        db, fs_scan, lrclib, youtube, ytdlp,
    },
    core::{
        importer::{DownloadJob, ImportRequest, ImportResult},
        library::{Album, Artist, LibraryStats, Track},
        playback::{
            EqBand, EqSettings, LyricsData, PlaybackState, PlaybackStatus, PlayerCommand,
            RepeatMode as CoreRepeat, EQ_FREQUENCIES,
        },
        playlist::{CreatePlaylistRequest, Playlist, UpdatePlaylistRequest},
        sharing::{IdentityInfo, ImportShareResult},
        sync::SyncStatus,
    },
    error::Result,
    AppState,
};

// ── Library ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_library_stats(state: State<'_, AppState>) -> Result<LibraryStats> {
    db::get_library_stats(&state.db).await
}

#[tauri::command]
pub async fn get_tracks(state: State<'_, AppState>, limit: u32, offset: u32) -> Result<Vec<Track>> {
    db::get_tracks(&state.db, limit, offset).await
}

#[tauri::command]
pub async fn get_albums(state: State<'_, AppState>) -> Result<Vec<Album>> {
    db::get_albums(&state.db).await
}

#[tauri::command]
pub async fn get_artists(state: State<'_, AppState>) -> Result<Vec<Artist>> {
    db::get_artists(&state.db).await
}

#[tauri::command]
pub async fn get_playlist_tracks(
    state: State<'_, AppState>,
    playlist_id: String,
) -> Result<Vec<Track>> {
    let id = Uuid::parse_str(&playlist_id)
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;
    db::get_playlist_tracks(&state.db, id).await
}

#[tauri::command]
pub async fn search(state: State<'_, AppState>, query: String) -> Result<Vec<Track>> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let q = format!("%{}%", query.to_lowercase());
    let rows = sqlx::query(
        r#"SELECT t.*, ar.name AS artist_name, al.title AS album_title, al.year
           FROM tracks t
           JOIN artists ar ON ar.id = t.artist_id
           JOIN albums al ON al.id = t.album_id
           WHERE LOWER(t.title) LIKE ?1
              OR LOWER(ar.name) LIKE ?1
              OR LOWER(al.title) LIKE ?1
           ORDER BY t.title
           LIMIT 200"#,
    )
    .bind(&q)
    .fetch_all(&state.db)
    .await?;

    Ok(rows.iter().map(db::row_to_track_pub).collect())
}

#[cfg(desktop)]
#[tauri::command]
pub async fn add_library_folder(
    state: State<'_, AppState>,
    path: String,
    app_handle: tauri::AppHandle,
) -> Result<()> {
    db::add_watched_folder(&state.db, &path).await?;

    let pool = state.db.clone();
    let covers_dir = state.covers_dir.clone();
    let path_clone = path.clone();

    let handle_progress = app_handle.clone();
    let handle_done = app_handle.clone();

    tauri::async_runtime::spawn(async move {
        let _ = fs_scan::scan_folder(&pool, &path_clone, &covers_dir, move |progress| {
            let _ = handle_progress.emit(
                crate::events::LIBRARY_SCAN_PROGRESS,
                serde_json::json!({
                    "scanned": progress.scanned,
                    "total": progress.total,
                    "added": progress.added,
                    "skipped": progress.skipped,
                }),
            );
        })
        .await;

        let _ = handle_done.emit(crate::events::LIBRARY_SCAN_COMPLETE, ());
    });

    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
pub async fn remove_library_folder(state: State<'_, AppState>, path: String) -> Result<()> {
    db::remove_watched_folder(&state.db, &path).await
}

// ── Playback ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_playback_status(state: State<'_, AppState>) -> Result<PlaybackStatus> {
    let es = state.audio.get_state();
    let track = if let Some(id) = es.current_track_id {
        db::get_track_by_id(&state.db, id).await?
    } else {
        None
    };

    let repeat = match es.repeat {
        crate::adapters::audio::RepeatMode::Off => CoreRepeat::Off,
        crate::adapters::audio::RepeatMode::One => CoreRepeat::One,
        crate::adapters::audio::RepeatMode::All => CoreRepeat::All,
    };

    Ok(PlaybackStatus {
        state: if es.is_playing {
            PlaybackState::Playing
        } else if es.current_track_id.is_some() {
            PlaybackState::Paused
        } else {
            PlaybackState::Stopped
        },
        current_track: track,
        position_ms: es.position_ms,
        duration_ms: es.duration_ms,
        volume: es.volume,
        muted: es.muted,
        shuffle: es.shuffle,
        repeat,
        queue: es.queue,
        queue_index: es.queue_index,
    })
}

#[tauri::command]
pub async fn play_track(state: State<'_, AppState>, track_id: String) -> Result<()> {
    let id = Uuid::parse_str(&track_id)
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;
    let track = db::get_track_by_id(&state.db, id).await?;
    if let Some(t) = track {
        db::increment_play_count(&state.db, id).await?;
        state.audio.send(AudioCommand::Play {
            path: PathBuf::from(&t.file_path),
            track_id: id,
            duration_ms: t.duration_ms,
            replaygain_db: t.replaygain_track.unwrap_or(0.0),
        });
    }
    Ok(())
}

#[tauri::command]
pub async fn send_player_command(state: State<'_, AppState>, command: PlayerCommand) -> Result<()> {
    use crate::adapters::audio::RepeatMode as EngineRepeat;

    let cmd = match command {
        PlayerCommand::Play { track_id } => {
            let track = db::get_track_by_id(&state.db, track_id).await?;
            if let Some(t) = track {
                db::increment_play_count(&state.db, track_id).await?;
                AudioCommand::Play {
                    path: PathBuf::from(&t.file_path),
                    track_id,
                    duration_ms: t.duration_ms,
                    replaygain_db: t.replaygain_track.unwrap_or(0.0),
                }
            } else {
                return Ok(());
            }
        }
        PlayerCommand::PlayQueue {
            track_ids,
            start_index,
        } => {
            let mut entries = Vec::new();
            for id in &track_ids {
                if let Some(t) = db::get_track_by_id(&state.db, *id).await? {
                    entries.push(QueueEntry {
                        track_id: *id,
                        path: PathBuf::from(&t.file_path),
                        duration_ms: t.duration_ms,
                        replaygain_db: t.replaygain_track.unwrap_or(0.0),
                    });
                }
            }
            AudioCommand::PlayQueue {
                entries,
                index: start_index,
            }
        }
        PlayerCommand::Pause => AudioCommand::Pause,
        PlayerCommand::Resume => AudioCommand::Resume,
        PlayerCommand::Stop => AudioCommand::Stop,
        PlayerCommand::Seek { position_ms } => AudioCommand::Seek(position_ms),
        PlayerCommand::SetVolume { level } => AudioCommand::SetVolume(level),
        PlayerCommand::Mute => AudioCommand::Mute,
        PlayerCommand::Unmute => AudioCommand::Unmute,
        PlayerCommand::Next => AudioCommand::Next,
        PlayerCommand::Previous => AudioCommand::Previous,
        PlayerCommand::SetShuffle { enabled } => AudioCommand::SetShuffle(enabled),
        PlayerCommand::SetRepeat { mode } => AudioCommand::SetRepeat(match mode {
            CoreRepeat::Off => EngineRepeat::Off,
            CoreRepeat::One => EngineRepeat::One,
            CoreRepeat::All => EngineRepeat::All,
        }),
        PlayerCommand::QueueAdd { track_id } => {
            if let Some(t) = db::get_track_by_id(&state.db, track_id).await? {
                AudioCommand::QueueAdd(QueueEntry {
                    track_id,
                    path: PathBuf::from(&t.file_path),
                    duration_ms: t.duration_ms,
                    replaygain_db: t.replaygain_track.unwrap_or(0.0),
                })
            } else {
                return Ok(());
            }
        }
        PlayerCommand::QueueRemove { index } => AudioCommand::QueueRemove(index),
        PlayerCommand::QueueClear => AudioCommand::QueueClear,
        PlayerCommand::QueueMove { .. } => return Ok(()), // Phase 2
    };

    state.audio.send(cmd);
    Ok(())
}

// ── Playlists ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>> {
    db::get_playlists(&state.db).await
}

#[tauri::command]
pub async fn create_playlist(
    state: State<'_, AppState>,
    req: CreatePlaylistRequest,
) -> Result<Playlist> {
    db::create_playlist(&state.db, &req).await
}

#[tauri::command]
pub async fn update_playlist(
    state: State<'_, AppState>,
    id: String,
    req: UpdatePlaylistRequest,
) -> Result<()> {
    let uuid =
        Uuid::parse_str(&id).map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;
    db::update_playlist(&state.db, uuid, &req).await
}

#[tauri::command]
pub async fn delete_playlist(state: State<'_, AppState>, id: String) -> Result<()> {
    let uuid =
        Uuid::parse_str(&id).map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;
    db::delete_playlist(&state.db, uuid).await
}

#[tauri::command]
pub async fn add_to_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
    track_id: String,
) -> Result<()> {
    let p = Uuid::parse_str(&playlist_id)
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;
    let t = Uuid::parse_str(&track_id)
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;
    db::add_track_to_playlist(&state.db, p, t).await
}

#[tauri::command]
pub async fn remove_from_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
    position: u32,
) -> Result<()> {
    let p = Uuid::parse_str(&playlist_id)
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;
    db::remove_track_from_playlist(&state.db, p, position).await
}

// ── Phase 2: Lyrics ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_lyrics(
    state: State<'_, AppState>,
    track_id: String,
) -> Result<Option<LyricsData>> {
    let id = Uuid::parse_str(&track_id)
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;

    // Check DB cache first.
    if let Some((synced_lrc, plain)) = db::get_cached_lyrics(&state.db, id).await? {
        let synced = lrclib::parse_lrc(&synced_lrc);
        let plain_opt = if plain.is_empty() { None } else { Some(plain) };
        return Ok(Some(LyricsData {
            synced,
            plain: plain_opt,
        }));
    }

    // Fetch from LRCLIB.
    let track = match db::get_track_by_id(&state.db, id).await? {
        Some(t) => t,
        None => return Ok(None),
    };

    match lrclib::fetch_lyrics(
        &track.title,
        &track.artist,
        &track.album,
        track.duration_ms / 1000,
    )
    .await
    {
        Ok(Some(lyrics)) => {
            let synced_lrc = lrclib::lrc_to_string(&lyrics.synced);
            let plain_str = lyrics.plain.as_deref().unwrap_or("");
            let _ = db::cache_lyrics(&state.db, id, &synced_lrc, plain_str).await;
            Ok(Some(lyrics))
        }
        Ok(None) => {
            // Cache the "no lyrics" result to avoid re-fetching.
            let _ = db::cache_lyrics(&state.db, id, "", "").await;
            Ok(None)
        }
        Err(e) => {
            eprintln!("LRCLIB fetch error: {e}");
            Ok(None)
        }
    }
}

// ── Phase 2: EQ ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_eq_settings(state: State<'_, AppState>) -> Result<EqSettings> {
    let cfg = state.audio.eq_config.read().unwrap();
    Ok(EqSettings {
        enabled: cfg.enabled,
        preamp_db: cfg.preamp_db,
        bands: EQ_FREQUENCIES
            .iter()
            .zip(cfg.bands.iter())
            .map(|(&freq_hz, &gain_db)| EqBand { freq_hz, gain_db })
            .collect(),
    })
}

#[tauri::command]
pub async fn set_eq_settings(state: State<'_, AppState>, settings: EqSettings) -> Result<()> {
    {
        let mut cfg = state.audio.eq_config.write().unwrap();
        cfg.enabled = settings.enabled;
        cfg.preamp_db = settings.preamp_db.clamp(-12.0, 12.0);
        for (i, band) in settings.bands.iter().enumerate().take(10) {
            cfg.bands[i] = band.gain_db.clamp(-12.0, 12.0);
        }
    } // lock released before any await

    // Persist to settings table (best-effort).
    let json = serde_json::to_string(&settings).unwrap_or_default();
    let _ = db::set_setting(&state.db, "eq_settings", &json).await;

    Ok(())
}

// ── Import (Phase 3) ───────────────────────────────────────────────────────

#[cfg(desktop)]
#[tauri::command]
pub async fn import_url(
    app: AppHandle,
    state: State<'_, AppState>,
    req: ImportRequest,
) -> Result<ImportResult> {
    if !youtube::is_youtube_url(&req.url) {
        return Ok(ImportResult::Refused {
            reason: "Not a YouTube URL.".to_string(),
        });
    }

    if !ytdlp::check_available(&app).await {
        return Ok(ImportResult::Refused {
            reason: "yt-dlp not found on PATH. Install with: winget install yt-dlp.yt-dlp"
                .to_string(),
        });
    }

    // Resolve download directory: user setting or default ~/Music/Sravya Downloads
    let download_dir: PathBuf = match db::get_setting(&state.db, "download_dir").await? {
        Some(path) => PathBuf::from(path),
        None => dirs::audio_dir()
            .unwrap_or_else(|| state.data_dir.clone())
            .join("Sravya Downloads"),
    };
    tokio::fs::create_dir_all(&download_dir).await?;

    let title = ytdlp::fetch_title(&app, &req.url).await;

    let job = DownloadJob {
        id: Uuid::new_v4().to_string(),
        url: req.url.clone(),
        title,
        progress: 0.0,
        state: crate::core::importer::DownloadState::Queued,
    };
    let job_id = job.id.clone();
    let job_id_ret = job_id.clone();

    state.download_queue.lock().unwrap().push(job);

    // Clone everything the spawned task needs
    let queue = Arc::clone(&state.download_queue);
    let url = req.url.clone();
    let dir = download_dir.clone();
    let pool = state.db.clone();
    let covers_dir = state.covers_dir.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        match ytdlp::spawn_download(app_clone.clone(), queue, job_id, url, dir.clone()).await {
            Ok(_) => {
                let dir_str = dir.to_string_lossy().into_owned();
                let _ = fs_scan::scan_folder(&pool, &dir_str, &covers_dir, |_| {}).await;
                let _ = app_clone.emit(crate::events::LIBRARY_SCAN_COMPLETE, ());
            }
            Err(e) => {
                tracing::error!("yt-dlp download failed: {e}");
            }
        }
    });

    Ok(ImportResult::Queued { job_id: job_id_ret })
}

#[cfg(desktop)]
#[tauri::command]
pub async fn get_download_queue(state: State<'_, AppState>) -> Result<Vec<DownloadJob>> {
    let q = state.download_queue.lock().unwrap();
    Ok(q.clone())
}

#[cfg(desktop)]
#[tauri::command]
pub async fn get_download_settings(state: State<'_, AppState>) -> Result<serde_json::Value> {
    let dir = db::get_setting(&state.db, "download_dir").await?;
    Ok(serde_json::json!({ "downloadDir": dir }))
}

#[cfg(desktop)]
#[tauri::command]
pub async fn set_download_settings(state: State<'_, AppState>, download_dir: String) -> Result<()> {
    db::set_setting(&state.db, "download_dir", &download_dir).await?;
    Ok(())
}

// ── Sharing (Phase 4) ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_identity(_state: State<'_, AppState>) -> Result<IdentityInfo> {
    Err(crate::error::AppError::Crypto(
        "Identity not yet implemented (Phase 4).".to_string(),
    ))
}

#[tauri::command]
pub async fn export_playlist_share(
    _state: State<'_, AppState>,
    _playlist_id: String,
    _recipient_pubkey: String,
    _output_path: String,
) -> Result<()> {
    Err(crate::error::AppError::Crypto(
        "Sharing not yet implemented (Phase 4).".to_string(),
    ))
}

#[tauri::command]
pub async fn import_playlist_share(
    _state: State<'_, AppState>,
    _file_path: String,
) -> Result<ImportShareResult> {
    Err(crate::error::AppError::Crypto(
        "Sharing not yet implemented (Phase 4).".to_string(),
    ))
}

// ── LAN Sync ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_lan_server_info(state: State<'_, AppState>) -> Result<serde_json::Value> {
    let port = state
        .lan_server_port
        .load(std::sync::atomic::Ordering::SeqCst);

    let local_ip = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
    let server_name = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .map(|h| format!("Sravya-{}", h))
        .unwrap_or_else(|_| "Sravya Desktop".to_string());

    Ok(serde_json::json!({
        "address": format!("http://{}:{}", local_ip, port),
        "port": port,
        "serverName": server_name,
    }))
}

fn get_local_ip() -> Option<String> {
    // Connect to an external address without sending data to detect the local interface IP.
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    Some(socket.local_addr().ok()?.ip().to_string())
}

#[tauri::command]
pub async fn begin_pairing(state: State<'_, AppState>) -> Result<serde_json::Value> {
    let nonce: [u8; 32] = rand::random();
    let challenge = B64.encode(nonce);
    *state.lan_pairing_challenge.lock().await = Some(challenge.clone());

    let port = state
        .lan_server_port
        .load(std::sync::atomic::Ordering::SeqCst);
    let local_ip = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());

    // Encode as a pairing URI that the iOS app can scan as a QR code.
    let pairing_uri = format!(
        "sravya://pair?host={}&port={}&challenge={}",
        local_ip,
        port,
        urlencoding::encode(&challenge)
    );

    Ok(serde_json::json!({
        "challenge": challenge,
        "pairingUri": pairing_uri,
        "serverAddress": format!("http://{}:{}", local_ip, port),
    }))
}

#[tauri::command]
pub async fn get_paired_devices(
    state: State<'_, AppState>,
) -> Result<Vec<crate::lan::protocol::PairedDevice>> {
    crate::lan::change_log::list_paired_devices(&state.db).await
}

#[tauri::command]
pub async fn revoke_device(state: State<'_, AppState>, device_id: String) -> Result<()> {
    crate::lan::change_log::revoke_device(&state.db, &device_id).await
}

#[tauri::command]
pub async fn discover_servers(
    timeout_secs: Option<u64>,
) -> Result<Vec<crate::lan::protocol::DiscoveredServer>> {
    Ok(crate::lan::mdns::browse_for_servers(timeout_secs.unwrap_or(5)).await)
}

#[tauri::command]
pub async fn initiate_pairing(server_url: String) -> Result<serde_json::Value> {
    let resp = reqwest::Client::new()
        .post(format!("{}/pairing/begin", server_url))
        .send()
        .await
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;
    Ok(resp)
}

#[tauri::command]
pub async fn complete_pairing(
    state: State<'_, AppState>,
    server_url: String,
    device_name: String,
    challenge: String,
) -> Result<serde_json::Value> {
    // Load or generate device identity.
    let (signing_key, pubkey_b64) = get_or_create_identity(&state.db).await?;

    // Sign the challenge with the Ed25519 private key.
    use ed25519_dalek::Signer;
    let signature = signing_key.sign(challenge.as_bytes());
    let sig_b64 = B64.encode(signature.to_bytes());

    let payload = serde_json::json!({
        "deviceName": device_name,
        "devicePubkey": pubkey_b64,
        "challengeSig": sig_b64,
    });

    let resp: serde_json::Value = reqwest::Client::new()
        .post(format!("{}/pairing/confirm", server_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?
        .json()
        .await
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;

    if resp
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        let device_id = resp["deviceId"].as_str().unwrap_or("").to_string();
        // Persist the server connection info.
        let server_info = serde_json::json!({
            "serverUrl": server_url,
            "deviceId": device_id,
            "pubkey": pubkey_b64,
        });
        let _ = db::set_setting(&state.db, "lan_server", &server_info.to_string()).await;
    }

    Ok(resp)
}

/// Load the device Ed25519 identity from the DB, or create it on first use.
async fn get_or_create_identity(
    pool: &sqlx::SqlitePool,
) -> Result<(ed25519_dalek::SigningKey, String)> {
    if let Some(sk_b64) = db::get_setting(pool, "device_signing_key").await? {
        let sk_bytes = B64
            .decode(&sk_b64)
            .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;
        let sk_arr: [u8; 32] = sk_bytes
            .as_slice()
            .try_into()
            .map_err(|_| crate::error::AppError::Other(anyhow::anyhow!("bad key length")))?;
        let sk = ed25519_dalek::SigningKey::from_bytes(&sk_arr);
        let pk_b64 = B64.encode(sk.verifying_key().as_bytes());
        return Ok((sk, pk_b64));
    }

    let sk = ed25519_dalek::SigningKey::generate(&mut rand::rngs::OsRng);
    let pk_b64 = B64.encode(sk.verifying_key().as_bytes());
    let sk_b64 = B64.encode(sk.to_bytes());
    let _ = db::set_setting(pool, "device_signing_key", &sk_b64).await;
    let _ = db::set_setting(pool, "device_pubkey", &pk_b64).await;
    Ok((sk, pk_b64))
}

#[tauri::command]
pub async fn start_lan_sync(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<crate::lan::protocol::SyncReport> {
    let server_json = db::get_setting(&state.db, "lan_server")
        .await?
        .ok_or_else(|| {
            crate::error::AppError::Other(anyhow::anyhow!(
                "No paired server. Complete pairing first."
            ))
        })?;

    let server_info: serde_json::Value = serde_json::from_str(&server_json)
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;

    let server_url = server_info["serverUrl"]
        .as_str()
        .ok_or_else(|| crate::error::AppError::Other(anyhow::anyhow!("missing serverUrl")))?
        .to_string();
    let device_id = server_info["deviceId"]
        .as_str()
        .ok_or_else(|| crate::error::AppError::Other(anyhow::anyhow!("missing deviceId")))?
        .to_string();
    let pubkey_b64 = server_info["pubkey"]
        .as_str()
        .ok_or_else(|| crate::error::AppError::Other(anyhow::anyhow!("missing pubkey")))?
        .to_string();

    let hmac_key = crate::lan::auth::device_key(&pubkey_b64);

    let client = crate::lan::sync_client::SyncClient {
        server_url,
        device_id,
        hmac_key,
        db: state.db.clone(),
        data_dir: state.data_dir.clone(),
    };

    Ok(client.run_sync(&app).await)
}

#[tauri::command]
pub async fn get_lan_sync_status(state: State<'_, AppState>) -> Result<serde_json::Value> {
    let last_synced_at = db::get_setting(&state.db, "last_sync_timestamp").await?;
    let paired = db::get_setting(&state.db, "lan_server").await?.is_some();
    Ok(serde_json::json!({
        "isPaired": paired,
        "lastSyncedAt": last_synced_at,
    }))
}

/// Ask the paired desktop to download a YouTube URL on the iPhone's behalf.
/// The desktop runs yt-dlp; the resulting MP3 syncs back via the normal change_log flow.
#[tauri::command]
pub async fn import_url_remote(
    state: State<'_, AppState>,
    url: String,
) -> Result<serde_json::Value> {
    let server_json = db::get_setting(&state.db, "lan_server")
        .await?
        .ok_or_else(|| {
            crate::error::AppError::Other(anyhow::anyhow!(
                "Not paired with a desktop. Open the Sync tab to pair first."
            ))
        })?;

    let server_info: serde_json::Value = serde_json::from_str(&server_json)
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;

    let server_url = server_info["serverUrl"]
        .as_str()
        .ok_or_else(|| crate::error::AppError::Other(anyhow::anyhow!("missing serverUrl")))?;
    let device_id = server_info["deviceId"]
        .as_str()
        .ok_or_else(|| crate::error::AppError::Other(anyhow::anyhow!("missing deviceId")))?;
    let pubkey_b64 = server_info["pubkey"]
        .as_str()
        .ok_or_else(|| crate::error::AppError::Other(anyhow::anyhow!("missing pubkey")))?;

    let hmac_key = crate::lan::auth::device_key(pubkey_b64);
    let timestamp = chrono::Utc::now().timestamp() as u64;
    let sig = crate::lan::auth::sign_request("POST", "/import/url", timestamp, &hmac_key);

    let resp = reqwest::Client::new()
        .post(format!("{}/import/url", server_url))
        .header("x-sravya-device-id", device_id)
        .header("x-sravya-timestamp", timestamp.to_string())
        .header("x-sravya-signature", sig)
        .json(&serde_json::json!({ "url": url }))
        .send()
        .await
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?
        .error_for_status()
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!(e)))?;

    Ok(resp)
}

// ── Sync (Phase 5) ─────────────────────────────────────────────────────────

#[cfg(desktop)]
#[tauri::command]
pub async fn get_sync_status(_state: State<'_, AppState>) -> Result<Vec<SyncStatus>> {
    Ok(vec![])
}

#[cfg(desktop)]
#[tauri::command]
pub async fn connect_provider(_state: State<'_, AppState>, _provider: String) -> Result<String> {
    Err(crate::error::AppError::Other(anyhow::anyhow!(
        "Account sync not yet implemented (Phase 5)."
    )))
}

#[cfg(desktop)]
#[tauri::command]
pub async fn disconnect_provider(_state: State<'_, AppState>, _provider: String) -> Result<()> {
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
pub async fn trigger_sync(_state: State<'_, AppState>, _provider: String) -> Result<()> {
    Ok(())
}
