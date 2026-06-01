use crate::adapters::db;
use crate::cloud::{
    self, cloud_client,
    uploader::{self},
};
use crate::core::{player::RepeatMode, search};
use crate::error::AppError;
use crate::AppState;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};
use uuid::Uuid;

// ─── Library ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_tracks(state: State<'_, AppState>) -> Result<Vec<db::TrackRow>, AppError> {
    db::get_tracks(&state.pool).await
}

#[tauri::command]
pub async fn get_track(state: State<'_, AppState>, id: String) -> Result<Option<db::TrackRow>, AppError> {
    db::get_track(&state.pool, &id).await
}

#[tauri::command]
pub async fn search_tracks(state: State<'_, AppState>, query: String) -> Result<Vec<db::TrackRow>, AppError> {
    let all = db::get_tracks(&state.pool).await?;
    let results: Vec<db::TrackRow> = search::search_tracks(&all, &query).into_iter().cloned().collect();
    Ok(results)
}

#[tauri::command]
pub async fn delete_track(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    if let Some(track) = db::get_track(&state.pool, &id).await? {
        let file_path = PathBuf::from(&track.file_path);
        let _ = tokio::fs::remove_file(&file_path).await;
    }
    db::delete_track(&state.pool, &id).await?;
    db::log_change(&state.pool, "track", &id, "delete").await?;
    Ok(())
}

#[tauri::command]
pub async fn scan_library(state: State<'_, AppState>) -> Result<usize, AppError> {
    let dir = state.tracks_dir.clone();
    let count = crate::adapters::scanner::scan_directory(&state.pool, &dir, |_n, _p| {}).await?;
    Ok(count)
}

// ─── Playlists ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<db::PlaylistRow>, AppError> {
    db::get_playlists(&state.pool).await
}

#[tauri::command]
pub async fn create_playlist(state: State<'_, AppState>, name: String) -> Result<db::PlaylistRow, AppError> {
    let id = Uuid::new_v4().to_string();
    db::create_playlist(&state.pool, &id, &name).await?;
    Ok(db::PlaylistRow {
        id,
        name,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn delete_playlist(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    db::delete_playlist(&state.pool, &id).await
}

#[tauri::command]
pub async fn get_playlist_tracks(state: State<'_, AppState>, playlist_id: String) -> Result<Vec<db::TrackRow>, AppError> {
    db::get_playlist_tracks(&state.pool, &playlist_id).await
}

#[tauri::command]
pub async fn add_to_playlist(state: State<'_, AppState>, playlist_id: String, track_id: String, position: i64) -> Result<(), AppError> {
    db::add_to_playlist(&state.pool, &playlist_id, &track_id, position).await
}

// ─── Playback ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn play_track(state: State<'_, AppState>, track_id: String) -> Result<(), AppError> {
    let track = db::get_track(&state.pool, &track_id).await?
        .ok_or_else(|| AppError::Other("Track not found".into()))?;

    let path = PathBuf::from(&track.file_path);
    let duration = track.duration_ms.unwrap_or(0) as u64;
    state.player.play(&path, &track_id, duration)
}

#[tauri::command]
pub async fn pause(state: State<'_, AppState>) -> Result<(), AppError> {
    state.player.pause();
    Ok(())
}

#[tauri::command]
pub async fn resume(state: State<'_, AppState>) -> Result<(), AppError> {
    state.player.resume();
    Ok(())
}

#[tauri::command]
pub async fn set_volume(state: State<'_, AppState>, volume: f32) -> Result<(), AppError> {
    state.player.set_volume(volume);
    Ok(())
}

#[tauri::command]
pub async fn get_player_state(state: State<'_, AppState>) -> Result<crate::core::player::PlayerState, AppError> {
    Ok(state.player.get_state())
}

#[tauri::command]
pub async fn next_track(_state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
pub async fn prev_track(_state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
pub async fn seek(_state: State<'_, AppState>, _position_ms: u64) -> Result<(), AppError> {
    Ok(())
}

// ─── Settings ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, AppError> {
    db::get_setting(&state.pool, &key).await
}

#[tauri::command]
pub async fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), AppError> {
    db::set_setting(&state.pool, &key, &value).await
}

// ─── Cloud ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_cloud_settings(state: State<'_, AppState>) -> Result<cloud::CloudSettings, AppError> {
    let pool = &state.pool;
    let api_url = db::get_setting(pool, "cloud_api_url").await?
        .unwrap_or_else(|| "https://sravya.api.lawarnaaree.com.np".into());
    let api_key = db::get_setting(pool, "cloud_api_key").await?.unwrap_or_default();
    let auto_sync = db::get_setting(pool, "cloud_auto_sync").await?.map(|v| v == "true").unwrap_or(false);
    Ok(cloud::CloudSettings { api_url, api_key, auto_sync })
}

#[tauri::command]
pub async fn set_cloud_settings(state: State<'_, AppState>, settings: cloud::CloudSettings) -> Result<(), AppError> {
    let pool = &state.pool;
    db::set_setting(pool, "cloud_api_url", &settings.api_url).await?;
    db::set_setting(pool, "cloud_api_key", &settings.api_key).await?;
    db::set_setting(pool, "cloud_auto_sync", if settings.auto_sync { "true" } else { "false" }).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_cloud_sync_status(state: State<'_, AppState>) -> Result<cloud::CloudSyncStatus, AppError> {
    let settings = get_cloud_settings(state.clone()).await?;
    let last_synced_at = db::get_setting(&state.pool, "cloud_last_synced_at").await?;
    let last_pull_at = db::get_setting(&state.pool, "cloud_last_pull_at").await?;
    Ok(cloud::CloudSyncStatus::from_settings(&settings, last_synced_at, last_pull_at, false))
}

#[tauri::command]
pub async fn upload_track_to_cloud(
    app: AppHandle,
    state: State<'_, AppState>,
    track_id: String,
) -> Result<(), AppError> {
    let settings = get_cloud_settings(state.clone()).await?;
    uploader::upload_track(&app, &state.pool, &settings.api_url, &settings.api_key, &track_id, &state.tracks_dir).await
}

#[tauri::command]
pub async fn sync_all_to_cloud(app: AppHandle, state: State<'_, AppState>) -> Result<uploader::CloudSyncResult, AppError> {
    let settings = get_cloud_settings(state.clone()).await?;
    let result = uploader::sync_all(&app, &state.pool, &settings.api_url, &settings.api_key, &state.tracks_dir).await?;
    db::set_setting(&state.pool, "cloud_last_synced_at", &chrono::Utc::now().to_rfc3339()).await?;
    Ok(result)
}

#[tauri::command]
pub async fn pull_from_cloud(app: AppHandle, state: State<'_, AppState>) -> Result<cloud_client::CloudPullResult, AppError> {
    let settings = get_cloud_settings(state.clone()).await?;
    let last_pull = db::get_setting(&state.pool, "cloud_last_pull_at").await?;
    let result = cloud_client::run_pull(
        &app,
        &state.pool,
        &settings.api_url,
        &settings.api_key,
        &state.tracks_dir,
        last_pull.as_deref(),
    ).await?;
    db::set_setting(&state.pool, "cloud_last_pull_at", &result.server_time).await?;
    Ok(result)
}

// ─── Import (desktop only) ────────────────────────────────────────────────────

#[cfg(not(target_os = "ios"))]
#[tauri::command]
pub async fn import_url(
    app: AppHandle,
    state: State<'_, AppState>,
    url: String,
) -> Result<String, AppError> {
    let ytdlp_path = db::get_setting(&state.pool, "ytdlp_path").await?
        .unwrap_or_else(|| "yt-dlp".into());

    let track_id = crate::core::downloader::import_url(
        &app,
        &state.pool,
        &url,
        &state.tracks_dir,
        &ytdlp_path,
    ).await?;

    let auto_sync = db::get_setting(&state.pool, "cloud_auto_sync").await?
        .map(|v| v == "true")
        .unwrap_or(false);

    if auto_sync {
        let api_url = db::get_setting(&state.pool, "cloud_api_url").await?.unwrap_or_default();
        let api_key = db::get_setting(&state.pool, "cloud_api_key").await?.unwrap_or_default();
        if !api_url.is_empty() && !api_key.is_empty() {
            let app2 = app.clone();
            let pool2 = state.pool.clone();
            let tid = track_id.clone();
            let tracks_dir2 = state.tracks_dir.clone();
            tokio::spawn(async move {
                let _ = uploader::upload_track(&app2, &pool2, &api_url, &api_key, &tid, &tracks_dir2).await;
            });
        }
    }

    Ok(track_id)
}

// ─── LAN (desktop only) ───────────────────────────────────────────────────────

#[cfg(not(target_os = "ios"))]
#[tauri::command]
pub async fn start_lan_server(state: State<'_, AppState>) -> Result<(), AppError> {
    let pool = Arc::new(state.pool.clone());
    let tracks_dir = Arc::new(state.tracks_dir.clone());
    let hmac_key = Arc::new(b"sravya-lan-key".to_vec());

    let lan_state = crate::lan::server::LanState { pool, tracks_dir, hmac_key };
    tokio::spawn(async move {
        let _ = crate::lan::server::start_lan_server(lan_state).await;
    });
    Ok(())
}

#[cfg(not(target_os = "ios"))]
#[tauri::command]
pub async fn stop_lan_server() -> Result<(), AppError> {
    Ok(())
}

#[cfg(not(target_os = "ios"))]
#[tauri::command]
pub async fn get_lan_server_status() -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({ "running": true, "port": crate::lan::server::LAN_PORT }))
}

#[cfg(not(target_os = "ios"))]
#[tauri::command]
pub async fn get_pairing_qr_code(state: State<'_, AppState>) -> Result<String, AppError> {
    let ips = if_addrs::get_if_addrs()
        .map_err(|e| AppError::Other(e.to_string()))?;
    let ip = ips
        .into_iter()
        .find(|i| !i.is_loopback() && i.addr.ip().is_ipv4())
        .map(|i| i.addr.ip().to_string())
        .unwrap_or_else(|| "127.0.0.1".into());

    let url = format!("http://{}:{}", ip, crate::lan::server::LAN_PORT);
    Ok(url)
}

// ─── LAN (iOS only) ──────────────────────────────────────────────────────────

#[cfg(target_os = "ios")]
#[tauri::command]
pub async fn scan_qr_and_connect(state: State<'_, AppState>, url: String) -> Result<(), AppError> {
    db::set_setting(&state.pool, "lan_server_url", &url).await
}

#[cfg(target_os = "ios")]
#[tauri::command]
pub async fn start_lan_sync(app: AppHandle, state: State<'_, AppState>) -> Result<crate::lan::sync_client::LanSyncResult, AppError> {
    let server_url = db::get_setting(&state.pool, "lan_server_url").await?
        .ok_or_else(|| AppError::Other("No LAN server configured".into()))?;
    let last_synced = db::get_setting(&state.pool, "lan_last_synced_at").await?;

    let result = crate::lan::sync_client::run_sync(
        &app,
        &state.pool,
        &server_url,
        b"sravya-lan-key",
        &state.tracks_dir,
        last_synced.as_deref(),
    ).await?;

    db::set_setting(&state.pool, "lan_last_synced_at", &chrono::Utc::now().to_rfc3339()).await?;
    Ok(result)
}

#[cfg(target_os = "ios")]
#[tauri::command]
pub async fn get_lan_sync_status(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let url = db::get_setting(&state.pool, "lan_server_url").await?;
    Ok(serde_json::json!({ "connected": url.is_some(), "url": url }))
}
