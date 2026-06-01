use crate::adapters::db::TrackRow;
use crate::error::AppError;

pub fn search_tracks<'a>(tracks: &'a [TrackRow], query: &str) -> Vec<&'a TrackRow> {
    if query.is_empty() {
        return tracks.iter().collect();
    }
    let q = query.to_lowercase();
    tracks
        .iter()
        .filter(|t| {
            t.title.to_lowercase().contains(&q)
                || t.artist.as_deref().unwrap_or("").to_lowercase().contains(&q)
                || t.album.as_deref().unwrap_or("").to_lowercase().contains(&q)
        })
        .collect()
}
