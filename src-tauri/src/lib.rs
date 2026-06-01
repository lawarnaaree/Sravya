mod adapters;
mod cloud;
mod commands;
mod core;
mod crypto;
mod error;
mod events;
mod lan;

use adapters::db;
use core::player::Player;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

pub struct AppState {
    pub pool: sqlx::SqlitePool,
    pub player: Arc<Player>,
    pub tracks_dir: PathBuf,
    pub covers_dir: PathBuf,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            let data_dir = dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("Sravya");

            let db_path = data_dir.join("sravya.db");
            let tracks_dir = data_dir.join("tracks");
            let covers_dir = data_dir.join("covers");

            std::fs::create_dir_all(&tracks_dir)?;
            std::fs::create_dir_all(&covers_dir)?;

            let player = Arc::new(Player::new().expect("Audio init failed"));

            let pool = tauri::async_runtime::block_on(db::init_pool(&db_path))
                .expect("DB open failed");

            #[cfg(not(target_os = "ios"))]
            {
                let lan_state = lan::server::LanState {
                    pool: Arc::new(pool.clone()),
                    tracks_dir: Arc::new(tracks_dir.clone()),
                    hmac_key: Arc::new(b"sravya-lan-key".to_vec()),
                };
                tauri::async_runtime::spawn(async move {
                    let _ = lan::server::start_lan_server(lan_state).await;
                });
            }

            app.manage(AppState { pool, player, tracks_dir, covers_dir });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_tracks,
            commands::get_track,
            commands::search_tracks,
            commands::delete_track,
            commands::scan_library,
            commands::get_playlists,
            commands::create_playlist,
            commands::delete_playlist,
            commands::get_playlist_tracks,
            commands::add_to_playlist,
            commands::play_track,
            commands::pause,
            commands::resume,
            commands::set_volume,
            commands::get_player_state,
            commands::next_track,
            commands::prev_track,
            commands::seek,
            commands::get_setting,
            commands::set_setting,
            commands::get_cloud_settings,
            commands::set_cloud_settings,
            commands::get_cloud_sync_status,
            commands::upload_track_to_cloud,
            commands::sync_all_to_cloud,
            commands::pull_from_cloud,
        ])
        .run(tauri::generate_context!())
        .expect("error running Sravya");
}
