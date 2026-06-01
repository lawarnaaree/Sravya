'use strict'

const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

function createDatabase(dataDir) {
  const dbDir = path.join(dataDir, 'db')
  fs.mkdirSync(dbDir, { recursive: true })

  const db = new Database(path.join(dbDir, 'sravya.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT,
      album TEXT,
      track_no INTEGER,
      duration_ms INTEGER,
      file_hash TEXT NOT NULL UNIQUE,
      file_ext TEXT NOT NULL DEFAULT 'mp3',
      cover_hash TEXT,
      codec TEXT,
      sample_rate INTEGER,
      bitrate INTEGER,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS change_log (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_change_log_occurred_at ON change_log(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_tracks_file_hash ON tracks(file_hash);
  `)

  return db
}

module.exports = { createDatabase }
