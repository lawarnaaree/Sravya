use std::path::PathBuf;

use tauri::{Emitter, State};
use uuid::Uuid;

use crate::{
    adapters::{
        audio::{AudioCommand, QueueEntry},
        db, fs_scan, lrclib,
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

#[tauri::command]
pub async fn import_url(_state: State<'_, AppState>, _req: ImportRequest) -> Result<ImportResult> {
    Err(crate::error::AppError::ImportRefused(
        "Link import is not yet available (Phase 3).".to_string(),
    ))
}

#[tauri::command]
pub async fn get_download_queue(_state: State<'_, AppState>) -> Result<Vec<DownloadJob>> {
    Ok(vec![])
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

// ── Sync (Phase 5) ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_sync_status(_state: State<'_, AppState>) -> Result<Vec<SyncStatus>> {
    Ok(vec![])
}

#[tauri::command]
pub async fn connect_provider(_state: State<'_, AppState>, _provider: String) -> Result<String> {
    Err(crate::error::AppError::Other(anyhow::anyhow!(
        "Account sync not yet implemented (Phase 5)."
    )))
}

#[tauri::command]
pub async fn disconnect_provider(_state: State<'_, AppState>, _provider: String) -> Result<()> {
    Ok(())
}

#[tauri::command]
pub async fn trigger_sync(_state: State<'_, AppState>, _provider: String) -> Result<()> {
    Ok(())
}
