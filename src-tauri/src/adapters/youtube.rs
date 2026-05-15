use url::Url;

pub fn is_youtube_url(raw: &str) -> bool {
    Url::parse(raw)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_owned()))
        .map(|h| {
            matches!(
                h.as_str(),
                "www.youtube.com" | "youtube.com" | "youtu.be" | "m.youtube.com"
            )
        })
        .unwrap_or(false)
}
