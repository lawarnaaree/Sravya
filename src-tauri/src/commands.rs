use crate::core::{
    importer::{DownloadJob, ImportRequest, ImportResult},
    library::{Album, Artist, LibraryStats, Track},
    playback::{PlaybackStatus, PlayerCommand},
    playlist::{CreatePlaylistRequest, Playlist, UpdatePlaylistRequest},
    sharing::{IdentityInfo, ImportShareResult},
    sync::SyncStatus,
};
use crate::error::Result;
use crate::AppState;
use tauri::State;

// ── Library ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_library_stats(state: State<'_, AppState>) -> Result<LibraryStats> {
    let _ = state;
    todo!("Phase 1")
}

#[tauri::command]
pub async fn get_tracks(state: State<'_, AppState>, limit: u32, offset: u32) -> Result<Vec<Track>> {
    let _ = (state, limit, offset);
    todo!("Phase 1")
}

#[tauri::command]
pub async fn get_albums(state: State<'_, AppState>) -> Result<Vec<Album>> {
    let _ = state;
    todo!("Phase 1")
}

#[tauri::command]
pub async fn get_artists(state: State<'_, AppState>) -> Result<Vec<Artist>> {
    let _ = state;
    todo!("Phase 1")
}

#[tauri::command]
pub async fn search(state: State<'_, AppState>, query: String) -> Result<Vec<Track>> {
    let _ = (state, query);
    todo!("Phase 1")
}

#[tauri::command]
pub async fn add_library_folder(state: State<'_, AppState>, path: String) -> Result<()> {
    let _ = (state, path);
    todo!("Phase 1")
}

#[tauri::command]
pub async fn remove_library_folder(state: State<'_, AppState>, path: String) -> Result<()> {
    let _ = (state, path);
    todo!("Phase 1")
}

// ── Playback ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_playback_status(state: State<'_, AppState>) -> Result<PlaybackStatus> {
    let _ = state;
    todo!("Phase 1")
}

#[tauri::command]
pub async fn send_player_command(state: State<'_, AppState>, command: PlayerCommand) -> Result<()> {
    let _ = (state, command);
    todo!("Phase 1")
}

// ── Playlists ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>> {
    let _ = state;
    todo!("Phase 1")
}

#[tauri::command]
pub async fn create_playlist(
    state: State<'_, AppState>,
    req: CreatePlaylistRequest,
) -> Result<Playlist> {
    let _ = (state, req);
    todo!("Phase 1")
}

#[tauri::command]
pub async fn update_playlist(
    state: State<'_, AppState>,
    id: String,
    req: UpdatePlaylistRequest,
) -> Result<()> {
    let _ = (state, id, req);
    todo!("Phase 1")
}

#[tauri::command]
pub async fn delete_playlist(state: State<'_, AppState>, id: String) -> Result<()> {
    let _ = (state, id);
    todo!("Phase 1")
}

#[tauri::command]
pub async fn add_to_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
    track_id: String,
) -> Result<()> {
    let _ = (state, playlist_id, track_id);
    todo!("Phase 1")
}

#[tauri::command]
pub async fn remove_from_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
    position: u32,
) -> Result<()> {
    let _ = (state, playlist_id, position);
    todo!("Phase 1")
}

// ── Import ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn import_url(state: State<'_, AppState>, req: ImportRequest) -> Result<ImportResult> {
    let _ = (state, req);
    todo!("Phase 3")
}

#[tauri::command]
pub async fn get_download_queue(state: State<'_, AppState>) -> Result<Vec<DownloadJob>> {
    let _ = state;
    todo!("Phase 3")
}

// ── Sharing ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_identity(state: State<'_, AppState>) -> Result<IdentityInfo> {
    let _ = state;
    todo!("Phase 4")
}

#[tauri::command]
pub async fn export_playlist_share(
    state: State<'_, AppState>,
    playlist_id: String,
    recipient_pubkey: String,
    output_path: String,
) -> Result<()> {
    let _ = (state, playlist_id, recipient_pubkey, output_path);
    todo!("Phase 4")
}

#[tauri::command]
pub async fn import_playlist_share(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<ImportShareResult> {
    let _ = (state, file_path);
    todo!("Phase 4")
}

// ── Sync ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_sync_status(state: State<'_, AppState>) -> Result<Vec<SyncStatus>> {
    let _ = state;
    todo!("Phase 5")
}

#[tauri::command]
pub async fn connect_provider(state: State<'_, AppState>, provider: String) -> Result<String> {
    let _ = (state, provider);
    todo!("Phase 5")
}

#[tauri::command]
pub async fn disconnect_provider(state: State<'_, AppState>, provider: String) -> Result<()> {
    let _ = (state, provider);
    todo!("Phase 5")
}

#[tauri::command]
pub async fn trigger_sync(state: State<'_, AppState>, provider: String) -> Result<()> {
    let _ = (state, provider);
    todo!("Phase 5")
}
