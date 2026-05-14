mod adapters;
mod commands;
mod core;
mod crypto;
mod error;
pub mod events;

pub struct AppState {
    pub db: sqlx::SqlitePool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // library
            commands::get_library_stats,
            commands::get_tracks,
            commands::get_albums,
            commands::get_artists,
            commands::search,
            commands::add_library_folder,
            commands::remove_library_folder,
            // playback
            commands::get_playback_status,
            commands::send_player_command,
            // playlists
            commands::get_playlists,
            commands::create_playlist,
            commands::update_playlist,
            commands::delete_playlist,
            commands::add_to_playlist,
            commands::remove_from_playlist,
            // import
            commands::import_url,
            commands::get_download_queue,
            // sharing
            commands::get_identity,
            commands::export_playlist_share,
            commands::import_playlist_share,
            // sync
            commands::get_sync_status,
            commands::connect_provider,
            commands::disconnect_provider,
            commands::trigger_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Sravya");
}
