CREATE TABLE IF NOT EXISTS lyrics_cache (
    track_id    TEXT PRIMARY KEY,
    synced      TEXT,
    plain       TEXT,
    source      TEXT NOT NULL DEFAULT 'lrclib',
    fetched_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
);
