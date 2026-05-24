use std::{
    path::PathBuf,
    sync::{atomic::AtomicU16, Arc},
};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde_json::json;
use sqlx::SqlitePool;
use tauri::AppHandle;
use tokio::sync::{broadcast, Mutex};

use crate::{
    adapters::db,
    lan::{
        auth::{device_key, verify_request},
        change_log,
        protocol::*,
    },
};

// ── Shared server state ────────────────────────────────────────────────────

pub struct LanState {
    pub db: SqlitePool,
    pub data_dir: PathBuf,
    pub covers_dir: PathBuf,
    pub pairing_challenge: Arc<Mutex<Option<String>>>,
    pub server_name: String,
    pub ws_tx: broadcast::Sender<serde_json::Value>,
    pub app_handle: AppHandle,
}

type Shared = Arc<LanState>;

// ── Entry point ────────────────────────────────────────────────────────────

pub async fn start(
    db: SqlitePool,
    data_dir: PathBuf,
    covers_dir: PathBuf,
    port_sink: Arc<AtomicU16>,
    pairing_challenge: Arc<Mutex<Option<String>>>,
    server_name: String,
    ws_tx: broadcast::Sender<serde_json::Value>,
    app_handle: AppHandle,
) -> anyhow::Result<()> {
    let state = Arc::new(LanState {
        db,
        data_dir,
        covers_dir,
        pairing_challenge,
        server_name,
        ws_tx,
        app_handle,
    });

    let app = build_router(state);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:0").await?;
    let port = listener.local_addr()?.port();
    port_sink.store(port, std::sync::atomic::Ordering::SeqCst);
    tracing::info!("LAN server listening on :{}", port);

    axum::serve(listener, app).await?;
    Ok(())
}

fn build_router(state: Shared) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/info", get(server_info))
        .route("/pairing/begin", post(pairing_begin))
        .route("/pairing/confirm", post(pairing_confirm))
        .route("/library/tracks", get(library_tracks))
        .route("/library/tracks/:id", get(library_track_by_id))
        .route("/library/albums", get(library_albums))
        .route("/library/artists", get(library_artists))
        .route("/library/playlists", get(library_playlists))
        .route("/sync/changes", get(sync_changes))
        .route("/files/:hash", get(serve_file))
        .route("/files/:hash/cover", get(serve_cover))
        .route("/ws/events", get(ws_handler))
        .route("/import/url", post(import_url_handler))
        .with_state(state)
}

// ── Authentication ─────────────────────────────────────────────────────────

async fn authenticate(
    headers: &HeaderMap,
    db: &SqlitePool,
    method: &str,
    path: &str,
) -> Result<String, StatusCode> {
    let device_id = headers
        .get("x-sravya-device-id")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let timestamp: u64 = headers
        .get("x-sravya-timestamp")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let signature = headers
        .get("x-sravya-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let pubkey_b64 = change_log::get_device_pubkey(db, device_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let key = device_key(&pubkey_b64);
    if !verify_request(method, path, timestamp, signature, &key, 30) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let _ = change_log::touch_device(db, device_id).await;
    Ok(device_id.to_string())
}

// ── Unauthenticated routes ─────────────────────────────────────────────────

async fn health() -> impl IntoResponse {
    Json(json!({ "ok": true }))
}

async fn server_info(State(state): State<Shared>) -> impl IntoResponse {
    Json(json!({
        "name": state.server_name,
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn pairing_begin(State(state): State<Shared>) -> impl IntoResponse {
    let nonce: [u8; 32] = rand::random();
    let challenge = B64.encode(nonce);
    *state.pairing_challenge.lock().await = Some(challenge.clone());
    Json(json!({
        "challenge": challenge,
        "serverName": state.server_name,
    }))
}

async fn pairing_confirm(
    State(state): State<Shared>,
    Json(req): Json<PairingConfirmRequest>,
) -> impl IntoResponse {
    let challenge = {
        let lock = state.pairing_challenge.lock().await;
        match lock.clone() {
            Some(c) => c,
            None => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "no active challenge" })),
                )
                    .into_response()
            }
        }
    };

    let pk_bytes = match B64.decode(&req.device_pubkey) {
        Ok(b) => b,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invalid pubkey encoding" })),
            )
                .into_response()
        }
    };

    let pk_array: [u8; 32] = match pk_bytes.as_slice().try_into() {
        Ok(a) => a,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "pubkey must be 32 bytes" })),
            )
                .into_response()
        }
    };

    let verifying_key = match ed25519_dalek::VerifyingKey::from_bytes(&pk_array) {
        Ok(k) => k,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invalid Ed25519 key" })),
            )
                .into_response()
        }
    };

    let sig_bytes = match B64.decode(&req.challenge_sig) {
        Ok(b) => b,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invalid signature encoding" })),
            )
                .into_response()
        }
    };

    let signature = match ed25519_dalek::Signature::from_slice(&sig_bytes) {
        Ok(s) => s,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invalid signature format" })),
            )
                .into_response()
        }
    };

    use ed25519_dalek::Verifier;
    if verifying_key
        .verify(challenge.as_bytes(), &signature)
        .is_err()
    {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "signature mismatch" })),
        )
            .into_response();
    }

    let device_id = uuid::Uuid::new_v4().to_string();
    let _ = change_log::insert_paired_device(
        &state.db,
        &device_id,
        &req.device_name,
        "ios",
        &req.device_pubkey,
    )
    .await;

    // One-time challenge — clear after use.
    *state.pairing_challenge.lock().await = None;

    Json(json!({ "deviceId": device_id, "success": true })).into_response()
}

// ── Authenticated library routes ───────────────────────────────────────────

async fn library_tracks(State(state): State<Shared>, headers: HeaderMap) -> impl IntoResponse {
    if authenticate(&headers, &state.db, "GET", "/library/tracks")
        .await
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    match db::get_tracks(&state.db, 10_000, 0).await {
        Ok(tracks) => Json(tracks).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
struct TrackIdPath {
    id: String,
}

async fn library_track_by_id(
    State(state): State<Shared>,
    headers: HeaderMap,
    Path(TrackIdPath { id }): Path<TrackIdPath>,
) -> impl IntoResponse {
    let path = format!("/library/tracks/{}", id);
    if authenticate(&headers, &state.db, "GET", &path)
        .await
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    match uuid::Uuid::parse_str(&id) {
        Ok(uuid) => match db::get_track_by_id(&state.db, uuid).await {
            Ok(Some(track)) => Json(track).into_response(),
            Ok(None) => StatusCode::NOT_FOUND.into_response(),
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
        },
        Err(_) => StatusCode::BAD_REQUEST.into_response(),
    }
}

async fn library_albums(State(state): State<Shared>, headers: HeaderMap) -> impl IntoResponse {
    if authenticate(&headers, &state.db, "GET", "/library/albums")
        .await
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    match db::get_albums(&state.db).await {
        Ok(albums) => Json(albums).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn library_artists(State(state): State<Shared>, headers: HeaderMap) -> impl IntoResponse {
    if authenticate(&headers, &state.db, "GET", "/library/artists")
        .await
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    match db::get_artists(&state.db).await {
        Ok(artists) => Json(artists).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn library_playlists(State(state): State<Shared>, headers: HeaderMap) -> impl IntoResponse {
    if authenticate(&headers, &state.db, "GET", "/library/playlists")
        .await
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    match db::get_playlists(&state.db).await {
        Ok(playlists) => Json(playlists).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
struct SinceQuery {
    since: Option<String>,
}

async fn sync_changes(
    State(state): State<Shared>,
    headers: HeaderMap,
    Query(params): Query<SinceQuery>,
) -> impl IntoResponse {
    if authenticate(&headers, &state.db, "GET", "/sync/changes")
        .await
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    let since = params.since.as_deref().unwrap_or("1970-01-01T00:00:00Z");
    match change_log::query_changes_since(&state.db, since).await {
        Ok(changes) => Json(ChangesResponse {
            changes,
            server_time: chrono::Utc::now().to_rfc3339(),
        })
        .into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

// ── File streaming ─────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct HashPath {
    hash: String,
}

async fn serve_file(
    State(state): State<Shared>,
    headers: HeaderMap,
    Path(HashPath { hash }): Path<HashPath>,
) -> impl IntoResponse {
    let path_str = format!("/files/{}", hash);
    if authenticate(&headers, &state.db, "GET", &path_str)
        .await
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }

    let file_path: Option<String> =
        sqlx::query_scalar("SELECT file_path FROM tracks WHERE file_hash = ?1")
            .bind(&hash)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);

    let file_path = match file_path {
        Some(p) => p,
        None => return StatusCode::NOT_FOUND.into_response(),
    };

    let content_type = match std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
    {
        Some("flac") => "audio/flac",
        Some("mp3") => "audio/mpeg",
        Some("m4a") | Some("aac") => "audio/mp4",
        Some("ogg") => "audio/ogg",
        Some("opus") => "audio/opus",
        Some("wav") => "audio/wav",
        Some("aiff") | Some("aif") => "audio/aiff",
        _ => "application/octet-stream",
    };

    let range_header = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let file = match tokio::fs::File::open(&file_path).await {
        Ok(f) => f,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    let file_size = match file.metadata().await {
        Ok(m) => m.len(),
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    if let Some(range_str) = range_header {
        if let Some(range_part) = range_str.strip_prefix("bytes=") {
            let parts: Vec<&str> = range_part.splitn(2, '-').collect();
            if parts.len() == 2 {
                let start: u64 = parts[0].parse().unwrap_or(0);
                let end: u64 = parts[1]
                    .parse()
                    .unwrap_or(file_size.saturating_sub(1))
                    .min(file_size.saturating_sub(1));
                let length = end.saturating_sub(start) + 1;

                use tokio::io::{AsyncReadExt, AsyncSeekExt};
                let mut file = file;
                if file.seek(std::io::SeekFrom::Start(start)).await.is_err() {
                    return StatusCode::RANGE_NOT_SATISFIABLE.into_response();
                }
                let limited = file.take(length);
                let stream = tokio_util::io::ReaderStream::new(limited);

                return Response::builder()
                    .status(StatusCode::PARTIAL_CONTENT)
                    .header(header::CONTENT_TYPE, content_type)
                    .header(header::CONTENT_LENGTH, length.to_string())
                    .header(
                        header::CONTENT_RANGE,
                        format!("bytes {}-{}/{}", start, end, file_size),
                    )
                    .header(header::ACCEPT_RANGES, "bytes")
                    .body(axum::body::Body::from_stream(stream))
                    .unwrap()
                    .into_response();
            }
        }
    }

    let stream = tokio_util::io::ReaderStream::new(file);
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, file_size.to_string())
        .header(header::ACCEPT_RANGES, "bytes")
        .body(axum::body::Body::from_stream(stream))
        .unwrap()
        .into_response()
}

async fn serve_cover(
    State(state): State<Shared>,
    headers: HeaderMap,
    Path(HashPath { hash }): Path<HashPath>,
) -> impl IntoResponse {
    let path_str = format!("/files/{}/cover", hash);
    if authenticate(&headers, &state.db, "GET", &path_str)
        .await
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }

    let cover_path: Option<String> =
        sqlx::query_scalar("SELECT cover_path FROM tracks WHERE file_hash = ?1")
            .bind(&hash)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None)
            .flatten();

    match cover_path {
        None => StatusCode::NOT_FOUND.into_response(),
        Some(p) => match tokio::fs::read(&p).await {
            Ok(bytes) => Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "image/jpeg")
                .body(axum::body::Body::from(bytes))
                .unwrap()
                .into_response(),
            Err(_) => StatusCode::NOT_FOUND.into_response(),
        },
    }
}

// ── WebSocket ──────────────────────────────────────────────────────────────

async fn ws_handler(
    State(state): State<Shared>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    if authenticate(&headers, &state.db, "GET", "/ws/events")
        .await
        .is_err()
    {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let rx = state.ws_tx.subscribe();
    ws.on_upgrade(move |socket| handle_ws(socket, rx))
}

async fn handle_ws(mut socket: WebSocket, mut rx: broadcast::Receiver<serde_json::Value>) {
    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Ok(msg) => {
                        if socket.send(Message::Text(msg.to_string().into())).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                }
            }
            client_msg = socket.recv() => {
                match client_msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }
}

/// Push a library-changed event to all connected WebSocket clients.
pub fn broadcast_library_change(
    tx: &broadcast::Sender<serde_json::Value>,
    entity_type: &str,
    entity_id: &str,
) {
    let _ = tx.send(json!({
        "type": "library_changed",
        "entityType": entity_type,
        "entityId": entity_id,
    }));
}

// ── Remote YouTube import (iPhone → desktop) ───────────────────────────────
// iOS can't run yt-dlp. When the iPhone copies a YouTube URL, it POSTs here.
// The desktop downloads with yt-dlp, the new track lands in change_log, and
// the next sync (or WebSocket push) pulls the MP3 back to the phone.

#[derive(serde::Deserialize)]
struct ImportUrlBody {
    url: String,
}

#[cfg(desktop)]
async fn import_url_handler(
    State(state): State<Shared>,
    headers: HeaderMap,
    Json(body): Json<ImportUrlBody>,
) -> Response {
    if authenticate(&headers, &state.db, "POST", "/import/url")
        .await
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }

    use crate::adapters::{fs_scan, youtube, ytdlp};
    use crate::core::importer::{DownloadJob, DownloadState};
    use tauri::Manager;

    if !youtube::is_youtube_url(&body.url) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Not a YouTube URL" })),
        )
            .into_response();
    }

    let app = state.app_handle.clone();
    if !ytdlp::check_available(&app).await {
        return (
            StatusCode::FAILED_DEPENDENCY,
            Json(json!({ "error": "yt-dlp not installed on desktop" })),
        )
            .into_response();
    }

    let app_state = match app.try_state::<crate::AppState>() {
        Some(s) => s,
        None => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    let download_dir = match db::get_setting(&app_state.db, "download_dir").await {
        Ok(Some(p)) => std::path::PathBuf::from(p),
        _ => dirs::audio_dir()
            .unwrap_or_else(|| app_state.data_dir.clone())
            .join("Sravya Downloads"),
    };
    if tokio::fs::create_dir_all(&download_dir).await.is_err() {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }

    let title = ytdlp::fetch_title(&app, &body.url).await;
    let job_id = uuid::Uuid::new_v4().to_string();

    let job = DownloadJob {
        id: job_id.clone(),
        url: body.url.clone(),
        title,
        progress: 0.0,
        state: DownloadState::Queued,
    };
    app_state.download_queue.lock().unwrap().push(job);

    let queue = Arc::clone(&app_state.download_queue);
    let url = body.url.clone();
    let dir = download_dir.clone();
    let pool = app_state.db.clone();
    let covers_dir = app_state.covers_dir.clone();
    let app_for_task = app.clone();
    let job_id_for_task = job_id.clone();

    tauri::async_runtime::spawn(async move {
        match ytdlp::spawn_download(
            app_for_task.clone(),
            queue,
            job_id_for_task,
            url,
            dir.clone(),
        )
        .await
        {
            Ok(_) => {
                let dir_str = dir.to_string_lossy().into_owned();
                let _ = fs_scan::scan_folder(&pool, &dir_str, &covers_dir, |_| {}).await;
                use tauri::Emitter;
                let _ = app_for_task.emit(crate::events::LIBRARY_SCAN_COMPLETE, ());
            }
            Err(e) => tracing::error!("LAN-triggered yt-dlp download failed: {e}"),
        }
    });

    Json(json!({ "jobId": job_id })).into_response()
}

#[cfg(not(desktop))]
async fn import_url_handler(
    State(_state): State<Shared>,
    _headers: HeaderMap,
    Json(_body): Json<ImportUrlBody>,
) -> Response {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({ "error": "YouTube import is only supported on the desktop server" })),
    )
        .into_response()
}
