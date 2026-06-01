use crate::adapters::db;
use crate::error::AppError;
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

pub const LAN_PORT: u16 = 41892;

#[derive(Clone)]
pub struct LanState {
    pub pool: Arc<SqlitePool>,
    pub tracks_dir: Arc<std::path::PathBuf>,
    pub hmac_key: Arc<Vec<u8>>,
}

#[derive(Deserialize)]
struct SinceQuery {
    since: Option<String>,
}

#[derive(Serialize)]
struct HealthResponse {
    ok: bool,
}

#[derive(Serialize)]
struct ChangesResponse {
    changes: Vec<ChangeEntry>,
    server_time: String,
}

#[derive(Serialize, sqlx::FromRow)]
struct ChangeEntry {
    seq: i64,
    entity_type: String,
    entity_id: String,
    operation: String,
    occurred_at: String,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { ok: true })
}

async fn sync_changes(
    State(state): State<LanState>,
    Query(q): Query<SinceQuery>,
) -> Result<Json<ChangesResponse>, StatusCode> {
    let rows: Vec<ChangeEntry> = if let Some(since) = q.since {
        sqlx::query_as(
            "SELECT seq, entity_type, entity_id, operation, occurred_at FROM change_log WHERE occurred_at > ? ORDER BY seq LIMIT 1000"
        )
        .bind(since)
        .fetch_all(&*state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query_as(
            "SELECT seq, entity_type, entity_id, operation, occurred_at FROM change_log ORDER BY seq LIMIT 1000"
        )
        .fetch_all(&*state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    Ok(Json(ChangesResponse {
        changes: rows,
        server_time: chrono::Utc::now().to_rfc3339(),
    }))
}

async fn track_file(
    State(state): State<LanState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let track = match db::get_track(&state.pool, &id).await {
        Ok(Some(t)) => t,
        _ => return (StatusCode::NOT_FOUND, Body::empty()).into_response(),
    };

    let file_path = state.tracks_dir.join(format!("{}.{}", track.file_hash, track.file_ext));
    match tokio::fs::read(&file_path).await {
        Ok(data) => (StatusCode::OK, Body::from(data)).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, Body::empty()).into_response(),
    }
}

pub async fn start_lan_server(state: LanState) -> Result<(), AppError> {
    let app = Router::new()
        .route("/health", get(health))
        .route("/sync/changes", get(sync_changes))
        .route("/tracks/:id/file", get(track_file))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = TcpListener::bind(format!("0.0.0.0:{}", LAN_PORT))
        .await
        .map_err(|e| AppError::Other(e.to_string()))?;

    axum::serve(listener, app)
        .await
        .map_err(|e| AppError::Other(e.to_string()))
}
