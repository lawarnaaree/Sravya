mod adapters;
mod commands;
mod core;
mod crypto;
mod error;
pub mod events;
pub mod lan;

use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicU16, Ordering},
        Arc, Mutex,
    },
};

use adapters::audio::AudioEngine;
use core::importer::DownloadJob;
use sqlx::SqlitePool;
use tauri::Manager;
use tokio::sync::{broadcast, Mutex as AsyncMutex};

pub struct AppState {
    pub db: SqlitePool,
    pub audio: Arc<AudioEngine>,
    pub covers_dir: PathBuf,
    pub data_dir: PathBuf,
    pub download_queue: Arc<Mutex<Vec<DownloadJob>>>,
    // LAN sync
    pub lan_server_port: Arc<AtomicU16>,
    pub lan_pairing_challenge: Arc<AsyncMutex<Option<String>>>,
    pub lan_ws_tx: broadcast::Sender<serde_json::Value>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Desktop-only plugins.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init())
            .plugin(tauri_plugin_shell::init());
    }

    // iOS-only plugins.
    #[cfg(target_os = "ios")]
    {
        builder = builder.plugin(tauri_plugin_barcode_scanner::init());
    }

    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
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

            // Restore persisted EQ settings.
            if let Ok(Some(json)) =
                tauri::async_runtime::block_on(adapters::db::get_setting(&db, "eq_settings"))
            {
                if let Ok(settings) = serde_json::from_str::<core::playback::EqSettings>(&json) {
                    let mut cfg = audio.eq_config.write().unwrap();
                    cfg.enabled = settings.enabled;
                    cfg.preamp_db = settings.preamp_db;
                    for (i, band) in settings.bands.iter().enumerate().take(10) {
                        cfg.bands[i] = band.gain_db;
                    }
                }
            }

            // On mobile, auto-scan the Documents directory where users can drop files
            #[cfg(mobile)]
            {
                if let Ok(doc_dir) = app.path().document_dir() {
                    let path_str = doc_dir.to_string_lossy().into_owned();
                    let db_clone = db.clone();
                    let covers_clone = covers_dir.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = adapters::db::add_watched_folder(&db_clone, &path_str).await;
                        let _ = adapters::fs_scan::scan_folder(
                            &db_clone,
                            &path_str,
                            &covers_clone,
                            |_| {},
                        )
                        .await;
                    });
                }
            }

            let (lan_ws_tx, _) = broadcast::channel::<serde_json::Value>(64);
            let lan_server_port = Arc::new(AtomicU16::new(0));
            let lan_pairing_challenge = Arc::new(AsyncMutex::new(None::<String>));

            // Spawn the LAN HTTP server on the tokio runtime Tauri already owns.
            // Desktop is the hub-and-spoke server; iOS is a client only.
            #[cfg(desktop)]
            {
                let db_lan = db.clone();
                let data_dir_lan = data_dir.clone();
                let covers_dir_lan = covers_dir.clone();
                let port_sink = Arc::clone(&lan_server_port);
                let challenge_lan = Arc::clone(&lan_pairing_challenge);
                let ws_tx_lan = lan_ws_tx.clone();
                let app_handle_lan = app.handle().clone();

                tauri::async_runtime::spawn(async move {
                    let server_name = std::env::var("COMPUTERNAME")
                        .or_else(|_| std::env::var("HOSTNAME"))
                        .map(|h| format!("Sravya-{}", h))
                        .unwrap_or_else(|_| "Sravya Desktop".to_string());

                    if let Err(e) = lan::server::start(
                        db_lan,
                        data_dir_lan,
                        covers_dir_lan,
                        port_sink,
                        challenge_lan,
                        server_name.clone(),
                        ws_tx_lan.clone(),
                        app_handle_lan,
                    )
                    .await
                    {
                        tracing::error!("LAN server error: {e}");
                    }
                });

                // Start mDNS advertisement after the port is known (poll briefly).
                let port_poll = Arc::clone(&lan_server_port);
                tauri::async_runtime::spawn(async move {
                    for _ in 0..50 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                        let port = port_poll.load(Ordering::SeqCst);
                        if port != 0 {
                            let server_name = std::env::var("COMPUTERNAME")
                                .or_else(|_| std::env::var("HOSTNAME"))
                                .map(|h| format!("Sravya-{}", h))
                                .unwrap_or_else(|_| "Sravya Desktop".to_string());

                            match lan::mdns::advertise(port, &server_name) {
                                Ok(daemon) => {
                                    // Keep alive — if dropped, mDNS stops advertising.
                                    std::mem::forget(daemon);
                                }
                                Err(e) => tracing::warn!("mDNS advertise failed: {e}"),
                            }
                            break;
                        }
                    }
                });
            }

            app.manage(AppState {
                db,
                audio,
                covers_dir,
                data_dir,
                download_queue: Arc::new(Mutex::new(Vec::new())),
                lan_server_port,
                lan_pairing_challenge,
                lan_ws_tx,
            });

            Ok(())
        })
        .invoke_handler({
            #[cfg(desktop)]
            {
                tauri::generate_handler![
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
                    // Phase 2: lyrics + EQ
                    commands::get_lyrics,
                    commands::get_eq_settings,
                    commands::set_eq_settings,
                    // import — desktop only (yt-dlp)
                    commands::import_url,
                    commands::get_download_queue,
                    commands::get_download_settings,
                    commands::set_download_settings,
                    // sharing — Phase 4
                    commands::get_identity,
                    commands::export_playlist_share,
                    commands::import_playlist_share,
                    // provider sync — Phase 5
                    commands::get_sync_status,
                    commands::connect_provider,
                    commands::disconnect_provider,
                    commands::trigger_sync,
                    // LAN sync
                    commands::get_lan_server_info,
                    commands::begin_pairing,
                    commands::get_paired_devices,
                    commands::revoke_device,
                    commands::discover_servers,
                    commands::initiate_pairing,
                    commands::complete_pairing,
                    commands::start_lan_sync,
                    commands::get_lan_sync_status,
                    commands::import_url_remote,
                ]
            }
            #[cfg(mobile)]
            {
                tauri::generate_handler![
                    // library (read-only on iOS — populated via LAN sync)
                    commands::get_library_stats,
                    commands::get_tracks,
                    commands::get_albums,
                    commands::get_artists,
                    commands::get_playlist_tracks,
                    commands::search,
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
                    // lyrics + EQ
                    commands::get_lyrics,
                    commands::get_eq_settings,
                    commands::set_eq_settings,
                    // sharing
                    commands::get_identity,
                    commands::export_playlist_share,
                    commands::import_playlist_share,
                    // LAN sync (iOS is the client side)
                    commands::discover_servers,
                    commands::initiate_pairing,
                    commands::complete_pairing,
                    commands::start_lan_sync,
                    commands::get_lan_sync_status,
                    commands::import_url_remote,
                ]
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Sravya");
}
