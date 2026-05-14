mod adapters;
mod commands;
mod core;
mod crypto;
mod error;
pub mod events;

use std::{path::PathBuf, sync::Arc};

use adapters::audio::AudioEngine;
use sqlx::SqlitePool;
use tauri::Manager;

pub struct AppState {
    pub db: SqlitePool,
    pub audio: Arc<AudioEngine>,
    pub covers_dir: PathBuf,
    pub data_dir: PathBuf,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data dir");
            std::fs::create_dir_all(&data_dir)?;

            let covers_dir = data_dir.join("covers");
            std::fs::create_dir_all(&covers_dir)?;

            let db_path = data_dir.join("library.db");

            let db = tauri::async_runtime::block_on(adapters::db::connect(&db_path))
                .expect("failed to connect to SQLite database");

            let audio = Arc::new(AudioEngine::new());

            app.manage(AppState {
                db,
                audio,
                covers_dir,
                data_dir,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // library
            commands::get_library_stats,
            commands::get_tracks,
            commands::get_albums,
            commands::get_artists,
            commands::get_playlist_tracks,
            commands::search,
            commands::add_library_folder,
            commands::remove_library_folder,
            // playback
            commands::get_playback_status,
            commands::send_player_command,
            commands::play_track,
            // playlists
            commands::get_playlists,
            commands::create_playlist,
            commands::update_playlist,
            commands::delete_playlist,
            commands::add_to_playlist,
            commands::remove_from_playlist,
            // import — Phase 3
            commands::import_url,
            commands::get_download_queue,
            // sharing — Phase 4
            commands::get_identity,
            commands::export_playlist_share,
            commands::import_playlist_share,
            // sync — Phase 5
            commands::get_sync_status,
            commands::connect_provider,
            commands::disconnect_provider,
            commands::trigger_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Sravya");
}
