use crate::error::AppError;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;
use std::str::FromStr;

pub async fn init_pool(db_path: &Path) -> Result<SqlitePool, AppError> {
    let url = format!("sqlite://{}?mode=rwc", db_path.display());
    let opts = SqliteConnectOptions::from_str(&url)
        .map_err(|e| AppError::Db(e.to_string()))?
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TrackRow {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub track_no: Option<i64>,
    pub duration_ms: Option<i64>,
    pub file_hash: String,
    pub file_ext: String,
    pub file_path: String,
    pub cover_hash: Option<String>,
    pub codec: Option<String>,
    pub sample_rate: Option<i64>,
    pub bitrate: Option<i64>,
    pub added_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct PlaylistRow {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

pub async fn get_tracks(pool: &SqlitePool) -> Result<Vec<TrackRow>, AppError> {
    let rows = sqlx::query_as::<_, TrackRow>(
        "SELECT id, title, artist, album, track_no, duration_ms, file_hash, file_ext, file_path, cover_hash, codec, sample_rate, bitrate, added_at FROM tracks ORDER BY artist, album, track_no, title"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_track(pool: &SqlitePool, id: &str) -> Result<Option<TrackRow>, AppError> {
    let row = sqlx::query_as::<_, TrackRow>(
        "SELECT id, title, artist, album, track_no, duration_ms, file_hash, file_ext, file_path, cover_hash, codec, sample_rate, bitrate, added_at FROM tracks WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn upsert_track(pool: &SqlitePool, track: &TrackRow) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO tracks (id, title, artist, album, track_no, duration_ms, file_hash, file_ext, file_path, cover_hash, codec, sample_rate, bitrate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&track.id)
    .bind(&track.title)
    .bind(&track.artist)
    .bind(&track.album)
    .bind(track.track_no)
    .bind(track.duration_ms)
    .bind(&track.file_hash)
    .bind(&track.file_ext)
    .bind(&track.file_path)
    .bind(&track.cover_hash)
    .bind(&track.codec)
    .bind(track.sample_rate)
    .bind(track.bitrate)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_track(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM tracks WHERE id = ?").bind(id).execute(pool).await?;
    Ok(())
}

pub async fn get_setting(pool: &SqlitePool, key: &str) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(|(v,)| v))
}

pub async fn set_setting(pool: &SqlitePool, key: &str, value: &str) -> Result<(), AppError> {
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind(key)
        .bind(value)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_playlists(pool: &SqlitePool) -> Result<Vec<PlaylistRow>, AppError> {
    let rows = sqlx::query_as::<_, PlaylistRow>(
        "SELECT id, name, created_at, updated_at FROM playlists ORDER BY name"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create_playlist(pool: &SqlitePool, id: &str, name: &str) -> Result<(), AppError> {
    sqlx::query("INSERT INTO playlists (id, name) VALUES (?, ?)")
        .bind(id)
        .bind(name)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_playlist(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM playlists WHERE id = ?").bind(id).execute(pool).await?;
    Ok(())
}

pub async fn get_playlist_tracks(pool: &SqlitePool, playlist_id: &str) -> Result<Vec<TrackRow>, AppError> {
    let rows = sqlx::query_as::<_, TrackRow>(
        "SELECT t.id, t.title, t.artist, t.album, t.track_no, t.duration_ms, t.file_hash, t.file_ext, t.file_path, t.cover_hash, t.codec, t.sample_rate, t.bitrate, t.added_at
         FROM tracks t
         JOIN playlist_tracks pt ON pt.track_id = t.id
         WHERE pt.playlist_id = ?
         ORDER BY pt.position"
    )
    .bind(playlist_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn add_to_playlist(pool: &SqlitePool, playlist_id: &str, track_id: &str, position: i64) -> Result<(), AppError> {
    sqlx::query("INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)")
        .bind(playlist_id)
        .bind(track_id)
        .bind(position)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn log_change(pool: &SqlitePool, entity_type: &str, entity_id: &str, operation: &str) -> Result<(), AppError> {
    sqlx::query("INSERT INTO change_log (entity_type, entity_id, operation) VALUES (?, ?, ?)")
        .bind(entity_type)
        .bind(entity_id)
        .bind(operation)
        .execute(pool)
        .await?;
    Ok(())
}
