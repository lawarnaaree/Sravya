use lofty::{
    file::TaggedFileExt,
    prelude::{AudioFile, ItemKey},
    probe::Probe,
};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use std::{
    io::Read,
    path::{Path, PathBuf},
    time::Instant,
};
use walkdir::WalkDir;

use crate::{
    adapters::db::{self, TrackInsert},
    error::Result,
};

static AUDIO_EXTENSIONS: &[&str] = &[
    "flac", "alac", "m4a", "aac", "mp3", "ogg", "opus", "wav", "aiff", "aif", "wv", "ape",
];

#[derive(Debug, Clone)]
pub struct ScanProgress {
    pub scanned: u32,
    pub total: u32,
    pub added: u32,
    pub skipped: u32,
}

pub fn collect_audio_files(root: &Path) -> Vec<PathBuf> {
    WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
                .unwrap_or(false)
        })
        .map(|e| e.into_path())
        .collect()
}

fn sha256_of_file(path: &Path) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Some(hex::encode(hasher.finalize()))
}

fn tag_str(tags: &lofty::tag::Tag, key: &ItemKey) -> Option<String> {
    tags.get_string(key)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn tag_u32(tags: &lofty::tag::Tag, key: &ItemKey) -> Option<u32> {
    tags.get_string(key)?.split('/').next()?.trim().parse().ok()
}

pub async fn scan_folder(
    pool: &SqlitePool,
    root: &str,
    covers_dir: &Path,
    on_progress: impl Fn(ScanProgress) + Send + 'static,
) -> Result<ScanProgress> {
    let root_path = PathBuf::from(root);
    let files = collect_audio_files(&root_path);
    let total = files.len() as u32;
    let mut added = 0u32;
    let mut skipped = 0u32;

    for (i, path) in files.iter().enumerate() {
        let hash = match sha256_of_file(path) {
            Some(h) => h,
            None => {
                skipped += 1;
                continue;
            }
        };

        // Skip if already indexed by hash.
        if db::file_hash_exists(pool, &hash).await? {
            skipped += 1;
            on_progress(ScanProgress {
                scanned: i as u32 + 1,
                total,
                added,
                skipped,
            });
            continue;
        }

        if let Err(e) = process_file(pool, path, &hash, covers_dir).await {
            eprintln!("Error scanning {:?}: {e}", path);
            skipped += 1;
        } else {
            added += 1;
        }

        on_progress(ScanProgress {
            scanned: i as u32 + 1,
            total,
            added,
            skipped,
        });
    }

    Ok(ScanProgress {
        scanned: total,
        total,
        added,
        skipped,
    })
}

async fn process_file(pool: &SqlitePool, path: &Path, hash: &str, covers_dir: &Path) -> Result<()> {
    let tagged = Probe::open(path)
        .map_err(|e| crate::error::AppError::Tag(e.to_string()))?
        .guess_file_type()
        .map_err(|e| crate::error::AppError::Tag(e.to_string()))?
        .read()
        .map_err(|e| crate::error::AppError::Tag(e.to_string()))?;

    let properties = tagged.properties();
    let duration_ms = properties.duration().as_millis() as u64;
    let sample_rate = properties.sample_rate();
    let bit_depth = properties.bit_depth().map(|b| b as u32);
    let bitrate = properties.overall_bitrate();
    let codec = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown")
        .to_uppercase();

    let primary_tag = tagged.primary_tag();
    let first_tag = tagged.first_tag();
    let tag = primary_tag.or(first_tag);

    let (title, artist, album, track_no, disc_no, year, cover_data) = if let Some(t) = tag {
        let cover_data = t
            .pictures()
            .iter()
            .find(|p| {
                p.pic_type() == lofty::picture::PictureType::CoverFront
                    || p.pic_type() == lofty::picture::PictureType::Other
            })
            .map(|p| p.data().to_vec());

        (
            tag_str(t, &ItemKey::TrackTitle)
                .or_else(|| path.file_stem().and_then(|s| s.to_str()).map(String::from))
                .unwrap_or_else(|| "Unknown".to_string()),
            tag_str(t, &ItemKey::TrackArtist)
                .or_else(|| tag_str(t, &ItemKey::AlbumArtist))
                .unwrap_or_else(|| "Unknown Artist".to_string()),
            tag_str(t, &ItemKey::AlbumTitle).unwrap_or_else(|| "Unknown Album".to_string()),
            tag_u32(t, &ItemKey::TrackNumber),
            tag_u32(t, &ItemKey::DiscNumber),
            tag_u32(t, &ItemKey::Year).map(|y| y as i32),
            cover_data,
        )
    } else {
        (
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string(),
            "Unknown Artist".to_string(),
            "Unknown Album".to_string(),
            None,
            None,
            None,
            None,
        )
    };

    let artist_id = db::upsert_artist(pool, &artist).await?;
    let album_id = db::upsert_album(pool, &album, artist_id, year).await?;

    // Save cover art.
    let cover_path = if let Some(data) = cover_data {
        let mut hasher = Sha256::new();
        hasher.update(&data);
        let img_hash = hex::encode(hasher.finalize());
        let cover_file = covers_dir.join(format!("{img_hash}.jpg"));
        if !cover_file.exists() {
            let _ = std::fs::write(&cover_file, &data);
        }
        let _ = db::set_album_cover(pool, album_id, cover_file.to_string_lossy().as_ref()).await;
        Some(cover_file.to_string_lossy().into_owned())
    } else {
        None
    };

    db::upsert_track(
        pool,
        &TrackInsert {
            title,
            album_id,
            artist_id,
            track_no,
            disc_no,
            duration_ms,
            file_path: path.to_string_lossy().into_owned(),
            file_hash: hash.to_string(),
            codec,
            bit_depth,
            sample_rate,
            bitrate,
            cover_path,
        },
    )
    .await?;

    Ok(())
}

pub struct _Timer {
    start: Instant,
    label: String,
}

impl _Timer {
    pub fn _new(label: &str) -> Self {
        Self {
            start: Instant::now(),
            label: label.to_string(),
        }
    }
}

impl Drop for _Timer {
    fn drop(&mut self) {
        eprintln!("{}: {:.2?}", self.label, self.start.elapsed());
    }
}
