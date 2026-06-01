use crate::adapters::db::TrackRow;
use crate::error::AppError;
use lofty::prelude::*;
use lofty::probe::Probe;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::Path;
use uuid::Uuid;

pub fn read_tags(path: &Path) -> Result<TrackRow, AppError> {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("mp3").to_lowercase();

    let mut file = fs::File::open(path)?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).map_err(AppError::from)?;
    let file_hash = format!("{:x}", Sha256::digest(&buf));
    drop(buf);

    let tagged = Probe::open(path)
        .map_err(|e| AppError::Tag(e.to_string()))?
        .read()
        .map_err(|e| AppError::Tag(e.to_string()))?;

    let props = tagged.properties();
    let duration_ms = Some(props.duration().as_millis() as i64);
    let sample_rate = props.sample_rate().map(|r| r as i64);
    let bitrate = props.audio_bitrate().map(|b| b as i64);
    let codec = Some(format!("{:?}", tagged.file_type()));

    let mut title = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string();
    let mut artist: Option<String> = None;
    let mut album: Option<String> = None;
    let mut track_no: Option<i64> = None;

    if let Some(tag) = tagged.primary_tag() {
        if let Some(t) = tag.title() { title = t.to_string(); }
        if let Some(a) = tag.artist() { artist = Some(a.to_string()); }
        if let Some(al) = tag.album() { album = Some(al.to_string()); }
        if let Some(tn) = tag.track() { track_no = Some(tn as i64); }
    }

    Ok(TrackRow {
        id: Uuid::new_v4().to_string(),
        title,
        artist,
        album,
        track_no,
        duration_ms,
        file_hash,
        file_ext: ext,
        file_path: path.to_string_lossy().to_string(),
        cover_hash: None,
        codec,
        sample_rate,
        bitrate,
        added_at: chrono::Utc::now().to_rfc3339(),
    })
}
