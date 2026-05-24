-- Devices that have completed the QR pairing flow
CREATE TABLE IF NOT EXISTS paired_devices (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    platform        TEXT NOT NULL DEFAULT 'ios',
    public_key_b64  TEXT NOT NULL UNIQUE,
    paired_at       TEXT NOT NULL,
    last_seen_at    TEXT,
    revoked_at      TEXT
);

-- Append-only log of library mutations used for delta sync.
-- iOS clients query WHERE occurred_at > last_sync_timestamp to get only new changes.
CREATE TABLE IF NOT EXISTS change_log (
    seq             INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    operation       TEXT NOT NULL,
    occurred_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_change_log_occurred ON change_log(occurred_at);
