use std::path::{Path, PathBuf};
use walkdir::WalkDir;

static AUDIO_EXTENSIONS: &[&str] = &[
    "flac", "alac", "m4a", "aac", "mp3", "ogg", "opus", "wav", "aiff", "aif", "wv", "ape",
];

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
