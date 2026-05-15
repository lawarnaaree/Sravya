use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

use regex::Regex;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

use crate::{
    core::importer::{DownloadJob, DownloadState},
    error::{AppError, Result},
    events,
};

// Resolve the yt-dlp binary path.
// On Windows, winget installs to %LOCALAPPDATA%\Microsoft\WinGet\Links\
// which may not be in PATH for the current process if installed mid-session.
fn resolve_ytdlp() -> String {
    #[cfg(target_os = "windows")]
    if let Some(local) = dirs::data_local_dir() {
        let candidate = local.join("Microsoft\\WinGet\\Links\\yt-dlp.exe");
        if candidate.exists() {
            return candidate.to_string_lossy().into_owned();
        }
        // Also check Program Files
        let pf = PathBuf::from("C:\\Program Files\\yt-dlp\\yt-dlp.exe");
        if pf.exists() {
            return pf.to_string_lossy().into_owned();
        }
    }
    "yt-dlp".to_string()
}

// Return a PATH string that prepends the winget links dir so yt-dlp
// can find its companion ffmpeg even when PATH hasn't been refreshed.
fn augmented_path() -> String {
    let current = std::env::var("PATH").unwrap_or_default();
    #[cfg(target_os = "windows")]
    if let Some(local) = dirs::data_local_dir() {
        let links = local.join("Microsoft\\WinGet\\Links");
        if links.exists() {
            return format!("{};{}", links.to_string_lossy(), current);
        }
    }
    current
}

pub async fn check_available(app: &AppHandle) -> bool {
    let bin = resolve_ytdlp();
    match app
        .shell()
        .command(&bin)
        .args(["--version"])
        .env("PATH", augmented_path())
        .output()
        .await
    {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}

pub async fn fetch_title(app: &AppHandle, url: &str) -> Option<String> {
    let bin = resolve_ytdlp();
    let out = app
        .shell()
        .command(&bin)
        .args(["-j", "--no-playlist", url])
        .env("PATH", augmented_path())
        .output()
        .await
        .ok()?;

    if !out.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&out.stdout);
    let val: serde_json::Value = serde_json::from_str(stdout.trim()).ok()?;
    val["title"].as_str().map(|s| s.to_owned())
}

fn update_job(queue: &Arc<Mutex<Vec<DownloadJob>>>, id: &str, f: impl FnOnce(&mut DownloadJob)) {
    if let Ok(mut q) = queue.lock() {
        if let Some(job) = q.iter_mut().find(|j| j.id == id) {
            f(job);
        }
    }
}

pub async fn spawn_download(
    app: AppHandle,
    queue: Arc<Mutex<Vec<DownloadJob>>>,
    job_id: String,
    url: String,
    download_dir: PathBuf,
) -> Result<PathBuf> {
    update_job(&queue, &job_id, |j| j.state = DownloadState::Downloading);
    if let Ok(q) = queue.lock() {
        if let Some(job) = q.iter().find(|j| j.id == job_id) {
            let _ = app.emit(events::DOWNLOAD_PROGRESS, job.clone());
        }
    }

    let output_template = download_dir.join("%(title)s.%(ext)s");
    let output_str = output_template.to_string_lossy().into_owned();
    let bin = resolve_ytdlp();
    let path_env = augmented_path();

    let args = vec![
        "--extract-audio".to_string(),
        "--audio-format".to_string(),
        "mp3".to_string(),
        "--audio-quality".to_string(),
        "0".to_string(),
        "--output".to_string(),
        output_str,
        "--progress".to_string(),
        "--newline".to_string(),
        "--no-playlist".to_string(),
        url,
    ];

    let (mut rx, _child) = app
        .shell()
        .command(&bin)
        .args(args)
        .env("PATH", path_env)
        .spawn()
        .map_err(|e| AppError::Other(anyhow::anyhow!("Failed to spawn yt-dlp: {e}")))?;

    let progress_re = Regex::new(r"\[download\]\s+(\d+\.?\d*)%").unwrap();
    let mut exit_code: Option<i32> = None;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let text = String::from_utf8_lossy(&line);
                if let Some(caps) = progress_re.captures(&text) {
                    if let Some(pct) = caps.get(1).and_then(|m| m.as_str().parse::<f32>().ok()) {
                        update_job(&queue, &job_id, |j| j.progress = pct / 100.0);
                        if let Ok(q) = queue.lock() {
                            if let Some(job) = q.iter().find(|j| j.id == job_id) {
                                let _ = app.emit(events::DOWNLOAD_PROGRESS, job.clone());
                            }
                        }
                    }
                }
            }
            CommandEvent::Stderr(line) => {
                tracing::debug!("yt-dlp stderr: {}", String::from_utf8_lossy(&line));
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
                break;
            }
            _ => {}
        }
    }

    if exit_code != Some(0) {
        let err = format!("yt-dlp exited with code {:?}", exit_code);
        update_job(&queue, &job_id, |j| {
            j.state = DownloadState::Failed { error: err.clone() };
        });
        if let Ok(q) = queue.lock() {
            if let Some(job) = q.iter().find(|j| j.id == job_id) {
                let _ = app.emit(events::DOWNLOAD_FAILED, job.clone());
            }
        }
        return Err(AppError::Other(anyhow::anyhow!(err)));
    }

    let downloaded_path = find_newest_mp3(&download_dir)?;

    update_job(&queue, &job_id, |j| {
        j.progress = 1.0;
        j.state = DownloadState::Done;
    });
    if let Ok(q) = queue.lock() {
        if let Some(job) = q.iter().find(|j| j.id == job_id) {
            let _ = app.emit(events::DOWNLOAD_COMPLETE, job.clone());
        }
    }

    Ok(downloaded_path)
}

fn find_newest_mp3(dir: &PathBuf) -> Result<PathBuf> {
    let mut newest: Option<(std::time::SystemTime, PathBuf)> = None;

    let entries = std::fs::read_dir(dir).map_err(AppError::Io)?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("mp3") {
            if let Ok(meta) = entry.metadata() {
                if let Ok(modified) = meta.modified() {
                    if newest.as_ref().map(|(t, _)| modified > *t).unwrap_or(true) {
                        newest = Some((modified, path));
                    }
                }
            }
        }
    }

    newest
        .map(|(_, p)| p)
        .ok_or_else(|| AppError::Other(anyhow::anyhow!("No .mp3 file found after download")))
}
