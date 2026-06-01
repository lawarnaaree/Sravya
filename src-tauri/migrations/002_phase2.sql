CREATE TABLE IF NOT EXISTS tags (
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (track_id, tag)
);

CREATE TABLE IF NOT EXISTS play_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  played_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
