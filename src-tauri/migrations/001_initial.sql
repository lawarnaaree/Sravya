CREATE TABLE IF NOT EXISTS artists (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    sort_name   TEXT,
    mbid        TEXT
);

CREATE TABLE IF NOT EXISTS albums (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    artist_id   TEXT NOT NULL REFERENCES artists(id),
    year        INTEGER,
    mbid        TEXT,
    cover_path  TEXT
);

CREATE TABLE IF NOT EXISTS tracks (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    album_id            TEXT REFERENCES albums(id),
    artist_id           TEXT REFERENCES artists(id),
    track_no            INTEGER,
    disc_no             INTEGER,
    duration_ms         INTEGER NOT NULL DEFAULT 0,
    file_path           TEXT NOT NULL UNIQUE,
    file_hash           TEXT NOT NULL,
    codec               TEXT NOT NULL DEFAULT '',
    bit_depth           INTEGER,
    sample_rate         INTEGER,
    bitrate             INTEGER,
    isrc                TEXT,
    mbid                TEXT,
    acoustid            TEXT,
    cover_path          TEXT,
    replaygain_track    REAL,
    replaygain_album    REAL,
    play_count          INTEGER NOT NULL DEFAULT 0,
    last_played_at      TEXT,
    added_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_hash ON tracks(file_hash);

CREATE TABLE IF NOT EXISTS playlists (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    cover_path      TEXT,
    owner_identity  TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id    TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    added_at    TEXT NOT NULL,
    PRIMARY KEY (playlist_id, position)
);

CREATE INDEX IF NOT EXISTS idx_playlist_tracks ON playlist_tracks(playlist_id, position);

CREATE TABLE IF NOT EXISTS plays (
    id          TEXT PRIMARY KEY,
    track_id    TEXT NOT NULL REFERENCES tracks(id),
    played_at   TEXT NOT NULL,
    completed   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS watched_folders (
    path        TEXT PRIMARY KEY,
    added_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
    id              TEXT PRIMARY KEY,
    track_id        TEXT REFERENCES tracks(id),
    kind            TEXT NOT NULL,
    url             TEXT,
    license         TEXT,
    imported_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS share_grants (
    id                  TEXT PRIMARY KEY,
    recipient_pubkey    TEXT NOT NULL,
    playlist_id         TEXT NOT NULL REFERENCES playlists(id),
    granted_at          TEXT NOT NULL,
    revoked_at          TEXT
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
    provider                TEXT PRIMARY KEY,
    encrypted_token         TEXT NOT NULL,
    refresh_expires_at      TEXT
);
