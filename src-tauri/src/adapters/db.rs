use chrono::Utc;
use sqlx::{sqlite::SqlitePoolOptions, Row, SqlitePool};
use std::path::Path;
use uuid::Uuid;

use crate::{
    core::{
        library::{Album, Artist, LibraryStats, Track},
        playlist::{CreatePlaylistRequest, Playlist, UpdatePlaylistRequest},
    },
    error::Result,
};

pub async fn connect(db_path: &Path) -> Result<SqlitePool> {
    let url = format!("sqlite:{}?mode=rwc", db_path.display());
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

// ── Library folders ────────────────────────────────────────────────────────

pub async fn add_watched_folder(pool: &SqlitePool, path: &str) -> Result<()> {
    sqlx::query("INSERT OR IGNORE INTO watched_folders (path, added_at) VALUES (?1, ?2)")
        .bind(path)
        .bind(Utc::now().to_rfc3339())
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn remove_watched_folder(pool: &SqlitePool, path: &str) -> Result<()> {
    sqlx::query("DELETE FROM watched_folders WHERE path = ?1")
        .bind(path)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_watched_folders(pool: &SqlitePool) -> Result<Vec<String>> {
    let rows = sqlx::query("SELECT path FROM watched_folders ORDER BY added_at")
        .fetch_all(pool)
        .await?;
    Ok(rows.iter().map(|r| r.get::<String, _>(0)).collect())
}

// ── Artist upsert ──────────────────────────────────────────────────────────

pub async fn upsert_artist(pool: &SqlitePool, name: &str) -> Result<Uuid> {
    let row = sqlx::query("SELECT id FROM artists WHERE name = ?1 COLLATE NOCASE")
        .bind(name)
        .fetch_optional(pool)
        .await?;

    if let Some(r) = row {
        return Ok(
            Uuid::parse_str(r.get::<String, _>(0).as_str()).unwrap_or_else(|_| Uuid::new_v4())
        );
    }

    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO artists (id, name) VALUES (?1, ?2)")
        .bind(id.to_string())
        .bind(name)
        .execute(pool)
        .await?;
    Ok(id)
}

// ── Album upsert ───────────────────────────────────────────────────────────

pub async fn upsert_album(
    pool: &SqlitePool,
    title: &str,
    artist_id: Uuid,
    year: Option<i32>,
) -> Result<Uuid> {
    let row =
        sqlx::query("SELECT id FROM albums WHERE title = ?1 COLLATE NOCASE AND artist_id = ?2")
            .bind(title)
            .bind(artist_id.to_string())
            .fetch_optional(pool)
            .await?;

    if let Some(r) = row {
        return Ok(
            Uuid::parse_str(r.get::<String, _>(0).as_str()).unwrap_or_else(|_| Uuid::new_v4())
        );
    }

    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO albums (id, title, artist_id, year) VALUES (?1, ?2, ?3, ?4)")
        .bind(id.to_string())
        .bind(title)
        .bind(artist_id.to_string())
        .bind(year)
        .execute(pool)
        .await?;
    Ok(id)
}

pub async fn set_album_cover(pool: &SqlitePool, album_id: Uuid, cover_path: &str) -> Result<()> {
    sqlx::query("UPDATE albums SET cover_path = ?1 WHERE id = ?2 AND cover_path IS NULL")
        .bind(cover_path)
        .bind(album_id.to_string())
        .execute(pool)
        .await?;
    Ok(())
}

// ── Track upsert ───────────────────────────────────────────────────────────

pub struct TrackInsert {
    pub title: String,
    pub album_id: Uuid,
    pub artist_id: Uuid,
    pub track_no: Option<u32>,
    pub disc_no: Option<u32>,
    pub duration_ms: u64,
    pub file_path: String,
    pub file_hash: String,
    pub codec: String,
    pub bit_depth: Option<u32>,
    pub sample_rate: Option<u32>,
    pub bitrate: Option<u32>,
    pub cover_path: Option<String>,
}

pub async fn upsert_track(pool: &SqlitePool, t: &TrackInsert) -> Result<Uuid> {
    let existing = sqlx::query("SELECT id FROM tracks WHERE file_path = ?1")
        .bind(&t.file_path)
        .fetch_optional(pool)
        .await?;

    if let Some(row) = existing {
        let id =
            Uuid::parse_str(row.get::<String, _>(0).as_str()).unwrap_or_else(|_| Uuid::new_v4());
        // Update hash in case file changed.
        sqlx::query("UPDATE tracks SET file_hash = ?1 WHERE id = ?2")
            .bind(&t.file_hash)
            .bind(id.to_string())
            .execute(pool)
            .await?;
        return Ok(id);
    }

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO tracks
           (id, title, album_id, artist_id, track_no, disc_no, duration_ms,
            file_path, file_hash, codec, bit_depth, sample_rate, bitrate,
            cover_path, play_count, added_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,0,?15)"#,
    )
    .bind(id.to_string())
    .bind(&t.title)
    .bind(t.album_id.to_string())
    .bind(t.artist_id.to_string())
    .bind(t.track_no)
    .bind(t.disc_no)
    .bind(t.duration_ms as i64)
    .bind(&t.file_path)
    .bind(&t.file_hash)
    .bind(&t.codec)
    .bind(t.bit_depth)
    .bind(t.sample_rate)
    .bind(t.bitrate)
    .bind(&t.cover_path)
    .bind(Utc::now().to_rfc3339())
    .execute(pool)
    .await?;

    // Append to change_log so iOS sync clients can detect new tracks.
    let _ = crate::lan::change_log::append_change(pool, "track", &id.to_string(), "upsert").await;

    Ok(id)
}

pub async fn file_hash_exists(pool: &SqlitePool, hash: &str) -> Result<bool> {
    let row = sqlx::query("SELECT 1 FROM tracks WHERE file_hash = ?1")
        .bind(hash)
        .fetch_optional(pool)
        .await?;
    Ok(row.is_some())
}

// ── Queries ────────────────────────────────────────────────────────────────

pub async fn get_library_stats(pool: &SqlitePool) -> Result<LibraryStats> {
    let track_row = sqlx::query("SELECT COUNT(*), COALESCE(SUM(duration_ms),0) FROM tracks")
        .fetch_one(pool)
        .await?;
    let album_count: i64 = sqlx::query("SELECT COUNT(*) FROM albums")
        .fetch_one(pool)
        .await?
        .get(0);
    let artist_count: i64 = sqlx::query("SELECT COUNT(*) FROM artists")
        .fetch_one(pool)
        .await?
        .get(0);
    let folders = get_watched_folders(pool).await?;

    Ok(LibraryStats {
        track_count: track_row.get::<i64, _>(0) as u64,
        album_count: album_count as u64,
        artist_count: artist_count as u64,
        total_duration_ms: track_row.get::<i64, _>(1) as u64,
        watched_folders: folders,
    })
}

pub fn row_to_track_pub(row: &sqlx::sqlite::SqliteRow) -> Track {
    row_to_track(row)
}

fn row_to_track(row: &sqlx::sqlite::SqliteRow) -> Track {
    Track {
        id: Uuid::parse_str(row.get::<String, _>("id").as_str()).unwrap_or_else(|_| Uuid::new_v4()),
        title: row.get("title"),
        artist: row.try_get("artist_name").unwrap_or_default(),
        album: row.try_get("album_title").unwrap_or_default(),
        album_artist: None,
        track_no: row.get::<Option<i64>, _>("track_no").map(|v| v as u32),
        disc_no: row.get::<Option<i64>, _>("disc_no").map(|v| v as u32),
        duration_ms: row.get::<i64, _>("duration_ms") as u64,
        year: row.get::<Option<i64>, _>("year").map(|v| v as i32),
        file_path: row.get("file_path"),
        file_hash: row.get("file_hash"),
        codec: row.get("codec"),
        bit_depth: row.get::<Option<i64>, _>("bit_depth").map(|v| v as u32),
        sample_rate: row.get::<Option<i64>, _>("sample_rate").map(|v| v as u32),
        bitrate: row.get::<Option<i64>, _>("bitrate").map(|v| v as u32),
        isrc: row.try_get("isrc").ok().flatten(),
        mbid: row.try_get("mbid").ok().flatten(),
        cover_path: row.get::<Option<String>, _>("cover_path"),
        replaygain_track: row
            .get::<Option<f64>, _>("replaygain_track")
            .map(|v| v as f32),
        replaygain_album: row
            .get::<Option<f64>, _>("replaygain_album")
            .map(|v| v as f32),
        play_count: row.get::<i64, _>("play_count") as u64,
        last_played_at: row.try_get("last_played_at").ok().flatten(),
        added_at: row.get("added_at"),
    }
}

pub async fn get_tracks(pool: &SqlitePool, limit: u32, offset: u32) -> Result<Vec<Track>> {
    let rows = sqlx::query(
        r#"SELECT t.*, ar.name AS artist_name, al.title AS album_title, al.year
           FROM tracks t
           JOIN artists ar ON ar.id = t.artist_id
           JOIN albums al ON al.id = t.album_id
           ORDER BY ar.name, al.year, t.disc_no, t.track_no, t.title
           LIMIT ?1 OFFSET ?2"#,
    )
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(pool)
    .await?;
    Ok(rows.iter().map(row_to_track).collect())
}

pub async fn get_track_by_id(pool: &SqlitePool, id: Uuid) -> Result<Option<Track>> {
    let row = sqlx::query(
        r#"SELECT t.*, ar.name AS artist_name, al.title AS album_title, al.year
           FROM tracks t
           JOIN artists ar ON ar.id = t.artist_id
           JOIN albums al ON al.id = t.album_id
           WHERE t.id = ?1"#,
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await?;
    Ok(row.as_ref().map(row_to_track))
}

pub async fn get_albums(pool: &SqlitePool) -> Result<Vec<Album>> {
    let rows = sqlx::query(
        r#"SELECT al.id, al.title, ar.name AS artist_name, al.year, al.mbid, al.cover_path,
                  COUNT(t.id) AS track_count
           FROM albums al
           JOIN artists ar ON ar.id = al.artist_id
           LEFT JOIN tracks t ON t.album_id = al.id
           GROUP BY al.id
           ORDER BY ar.name, al.year"#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .map(|r| Album {
            id: Uuid::parse_str(r.get::<String, _>("id").as_str())
                .unwrap_or_else(|_| Uuid::new_v4()),
            title: r.get("title"),
            artist: r.get("artist_name"),
            year: r.get::<Option<i64>, _>("year").map(|v| v as i32),
            mbid: r.get("mbid"),
            cover_path: r.get("cover_path"),
            track_count: r.get::<i64, _>("track_count") as u32,
        })
        .collect())
}

pub async fn get_artists(pool: &SqlitePool) -> Result<Vec<Artist>> {
    let rows = sqlx::query(
        r#"SELECT ar.id, ar.name, ar.sort_name, ar.mbid, COUNT(DISTINCT al.id) AS album_count
           FROM artists ar
           LEFT JOIN albums al ON al.artist_id = ar.id
           GROUP BY ar.id
           ORDER BY ar.name"#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .map(|r| Artist {
            id: Uuid::parse_str(r.get::<String, _>("id").as_str())
                .unwrap_or_else(|_| Uuid::new_v4()),
            name: r.get("name"),
            sort_name: r.get("sort_name"),
            mbid: r.get("mbid"),
            album_count: r.get::<i64, _>("album_count") as u32,
        })
        .collect())
}

pub async fn get_tracks_by_album(pool: &SqlitePool, album_id: Uuid) -> Result<Vec<Track>> {
    let rows = sqlx::query(
        r#"SELECT t.*, ar.name AS artist_name, al.title AS album_title, al.year
           FROM tracks t
           JOIN artists ar ON ar.id = t.artist_id
           JOIN albums al ON al.id = t.album_id
           WHERE t.album_id = ?1
           ORDER BY t.disc_no, t.track_no"#,
    )
    .bind(album_id.to_string())
    .fetch_all(pool)
    .await?;
    Ok(rows.iter().map(row_to_track).collect())
}

pub async fn increment_play_count(pool: &SqlitePool, track_id: Uuid) -> Result<()> {
    sqlx::query("UPDATE tracks SET play_count = play_count + 1, last_played_at = ?1 WHERE id = ?2")
        .bind(Utc::now().to_rfc3339())
        .bind(track_id.to_string())
        .execute(pool)
        .await?;
    Ok(())
}

// ── Playlists ──────────────────────────────────────────────────────────────

fn row_to_playlist(r: &sqlx::sqlite::SqliteRow) -> Playlist {
    Playlist {
        id: Uuid::parse_str(r.get::<String, _>("id").as_str()).unwrap_or_else(|_| Uuid::new_v4()),
        name: r.get("name"),
        description: r.get("description"),
        cover_path: r.get("cover_path"),
        track_count: r.get::<i64, _>("track_count") as u32,
        total_duration_ms: r.get::<i64, _>("total_duration_ms") as u64,
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

pub async fn get_playlists(pool: &SqlitePool) -> Result<Vec<Playlist>> {
    let rows = sqlx::query(
        r#"SELECT p.id, p.name, p.description, p.cover_path, p.created_at, p.updated_at,
                  COUNT(pt.track_id) AS track_count,
                  COALESCE(SUM(t.duration_ms), 0) AS total_duration_ms
           FROM playlists p
           LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
           LEFT JOIN tracks t ON t.id = pt.track_id
           GROUP BY p.id
           ORDER BY p.updated_at DESC"#,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.iter().map(row_to_playlist).collect())
}

pub async fn create_playlist(pool: &SqlitePool, req: &CreatePlaylistRequest) -> Result<Playlist> {
    let id = Uuid::new_v4();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO playlists (id, name, description, created_at, updated_at) VALUES (?1,?2,?3,?4,?5)",
    )
    .bind(id.to_string())
    .bind(&req.name)
    .bind(&req.description)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;

    Ok(Playlist {
        id,
        name: req.name.clone(),
        description: req.description.clone(),
        cover_path: None,
        track_count: 0,
        total_duration_ms: 0,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub async fn update_playlist(
    pool: &SqlitePool,
    id: Uuid,
    req: &UpdatePlaylistRequest,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    if let Some(name) = &req.name {
        sqlx::query("UPDATE playlists SET name = ?1, updated_at = ?2 WHERE id = ?3")
            .bind(name)
            .bind(&now)
            .bind(id.to_string())
            .execute(pool)
            .await?;
    }
    if let Some(desc) = &req.description {
        sqlx::query("UPDATE playlists SET description = ?1, updated_at = ?2 WHERE id = ?3")
            .bind(desc)
            .bind(&now)
            .bind(id.to_string())
            .execute(pool)
            .await?;
    }
    Ok(())
}

pub async fn delete_playlist(pool: &SqlitePool, id: Uuid) -> Result<()> {
    sqlx::query("DELETE FROM playlists WHERE id = ?1")
        .bind(id.to_string())
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn add_track_to_playlist(
    pool: &SqlitePool,
    playlist_id: Uuid,
    track_id: Uuid,
) -> Result<()> {
    let pos: i64 = sqlx::query(
        "SELECT COALESCE(MAX(position)+1, 0) FROM playlist_tracks WHERE playlist_id = ?1",
    )
    .bind(playlist_id.to_string())
    .fetch_one(pool)
    .await?
    .get(0);

    sqlx::query(
        "INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?1,?2,?3,?4)",
    )
    .bind(playlist_id.to_string())
    .bind(track_id.to_string())
    .bind(pos)
    .bind(Utc::now().to_rfc3339())
    .execute(pool)
    .await?;

    sqlx::query("UPDATE playlists SET updated_at = ?1 WHERE id = ?2")
        .bind(Utc::now().to_rfc3339())
        .bind(playlist_id.to_string())
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn remove_track_from_playlist(
    pool: &SqlitePool,
    playlist_id: Uuid,
    position: u32,
) -> Result<()> {
    sqlx::query("DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND position = ?2")
        .bind(playlist_id.to_string())
        .bind(position as i64)
        .execute(pool)
        .await?;
    // Re-number positions.
    sqlx::query(
        r#"UPDATE playlist_tracks SET position = (
               SELECT COUNT(*) FROM playlist_tracks AS pt2
               WHERE pt2.playlist_id = playlist_tracks.playlist_id
                 AND pt2.position < playlist_tracks.position
           )
           WHERE playlist_id = ?1"#,
    )
    .bind(playlist_id.to_string())
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_playlist_tracks(pool: &SqlitePool, playlist_id: Uuid) -> Result<Vec<Track>> {
    let rows = sqlx::query(
        r#"SELECT t.*, ar.name AS artist_name, al.title AS album_title, al.year
           FROM playlist_tracks pt
           JOIN tracks t ON t.id = pt.track_id
           JOIN artists ar ON ar.id = t.artist_id
           JOIN albums al ON al.id = t.album_id
           WHERE pt.playlist_id = ?1
           ORDER BY pt.position"#,
    )
    .bind(playlist_id.to_string())
    .fetch_all(pool)
    .await?;
    Ok(rows.iter().map(row_to_track).collect())
}

// ── Phase 2: Lyrics cache ─────────────────────────────────────────────────

pub async fn get_cached_lyrics(
    pool: &SqlitePool,
    track_id: Uuid,
) -> Result<Option<(String, String)>> {
    let row = sqlx::query("SELECT synced, plain FROM lyrics_cache WHERE track_id = ?1")
        .bind(track_id.to_string())
        .fetch_optional(pool)
        .await?;
    Ok(row.map(|r| {
        let synced: String = r.get::<Option<String>, _>("synced").unwrap_or_default();
        let plain: String = r.get::<Option<String>, _>("plain").unwrap_or_default();
        (synced, plain)
    }))
}

pub async fn cache_lyrics(
    pool: &SqlitePool,
    track_id: Uuid,
    synced: &str,
    plain: &str,
) -> Result<()> {
    sqlx::query(
        "INSERT OR REPLACE INTO lyrics_cache (track_id, synced, plain, fetched_at) VALUES (?1,?2,?3,?4)",
    )
    .bind(track_id.to_string())
    .bind(synced)
    .bind(plain)
    .bind(Utc::now().to_rfc3339())
    .execute(pool)
    .await?;
    Ok(())
}

// ── Phase 2: Settings ─────────────────────────────────────────────────────

pub async fn get_setting(pool: &SqlitePool, key: &str) -> Result<Option<String>> {
    let row = sqlx::query("SELECT value FROM settings WHERE key = ?1")
        .bind(key)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(|r| r.get::<String, _>("value")))
}

pub async fn set_setting(pool: &SqlitePool, key: &str, value: &str) -> Result<()> {
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)")
        .bind(key)
        .bind(value)
        .execute(pool)
        .await?;
    Ok(())
}
