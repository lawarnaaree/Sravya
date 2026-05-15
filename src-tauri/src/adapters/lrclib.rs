use crate::core::playback::{LyricsData, LyricsLine};
use crate::error::Result;

pub async fn fetch_lyrics(
    track_name: &str,
    artist_name: &str,
    album_name: &str,
    duration_secs: u64,
) -> Result<Option<LyricsData>> {
    let client = reqwest::Client::builder()
        .user_agent("Sravya/1.0 (github.com/user/sravya)")
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    let resp = client
        .get("https://lrclib.net/api/get")
        .query(&[
            ("track_name", track_name),
            ("artist_name", artist_name),
            ("album_name", album_name),
            ("duration", &duration_secs.to_string()),
        ])
        .send()
        .await?;

    if resp.status().as_u16() == 404 {
        return Ok(None);
    }

    if !resp.status().is_success() {
        return Ok(None);
    }

    let json: serde_json::Value = resp.json().await?;

    let synced_text = json["syncedLyrics"].as_str().unwrap_or("").to_string();
    let plain_text = json["plainLyrics"].as_str().map(str::to_string);

    let synced = parse_lrc(&synced_text);

    Ok(Some(LyricsData {
        synced,
        plain: plain_text.filter(|s| !s.is_empty()),
    }))
}

pub fn parse_lrc(lrc: &str) -> Vec<LyricsLine> {
    let mut lines = Vec::new();
    for line in lrc.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix('[') {
            if let Some(bracket_end) = rest.find(']') {
                let timestamp = &rest[..bracket_end];
                let text = rest[bracket_end + 1..].trim().to_string();
                if let Some(ms) = parse_timestamp(timestamp) {
                    if !text.is_empty() {
                        lines.push(LyricsLine { time_ms: ms, text });
                    }
                }
            }
        }
    }
    lines.sort_by_key(|l| l.time_ms);
    lines
}

pub fn lrc_to_string(lines: &[LyricsLine]) -> String {
    lines
        .iter()
        .map(|l| {
            let total_secs = l.time_ms / 1000;
            let mins = total_secs / 60;
            let secs = total_secs % 60;
            let centis = (l.time_ms % 1000) / 10;
            format!("[{:02}:{:02}.{:02}] {}", mins, secs, centis, l.text)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn parse_timestamp(ts: &str) -> Option<u64> {
    // Accepts mm:ss.xx or mm:ss.xxx
    let colon = ts.find(':')?;
    let mins: u64 = ts[..colon].parse().ok()?;
    let after_colon = &ts[colon + 1..];
    let (secs_str, millis_str) = match after_colon.find('.') {
        Some(dot) => (&after_colon[..dot], &after_colon[dot + 1..]),
        None => (after_colon, "0"),
    };
    let secs: u64 = secs_str.parse().ok()?;
    // centiseconds (xx) or milliseconds (xxx)
    let raw: u64 = millis_str.parse().ok()?;
    let ms_frac = if millis_str.len() <= 2 { raw * 10 } else { raw };
    Some(mins * 60_000 + secs * 1_000 + ms_frac)
}
