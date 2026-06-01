use crate::adapters::{db, tagger};
use crate::error::AppError;
use sqlx::SqlitePool;
use std::path::Path;
use walkdir::WalkDir;

const AUDIO_EXTS: &[&str] = &["flac", "alac", "m4a", "aac", "mp3", "ogg", "opus", "wav", "aiff", "wv", "ape"];

pub async fn scan_directory<F>(pool: &SqlitePool, dir: &Path, on_progress: F) -> Result<usize, AppError>
where
    F: Fn(usize, &str),
{
    let mut count = 0usize;

    let entries: Vec<_> = WalkDir::new(dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file()
                && e.path()
                    .extension()
                    .and_then(|x| x.to_str())
                    .map(|x| AUDIO_EXTS.contains(&x.to_lowercase().as_str()))
                    .unwrap_or(false)
        })
        .collect();

    for entry in &entries {
        let path = entry.path();
        match tagger::read_tags(path) {
            Ok(track) => {
                let existing = db::get_tracks(pool).await?;
                let already_exists = existing.iter().any(|t| t.file_hash == track.file_hash);
                if !already_exists {
                    db::upsert_track(pool, &track).await?;
                    db::log_change(pool, "track", &track.id, "upsert").await?;
                    count += 1;
                }
                on_progress(count, path.to_str().unwrap_or(""));
            }
            Err(e) => {
                tracing::warn!("Skipping {:?}: {}", path, e);
            }
        }
    }

    Ok(count)
}
