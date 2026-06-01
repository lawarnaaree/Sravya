const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDb } = require('../db/database');

const router = Router();

let tracksDir;
let upload;

function init(dataDir) {
  tracksDir = path.join(dataDir, 'uploads', 'tracks');
  fs.mkdirSync(tracksDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tracksDir),
    filename: (_req, _file, cb) => {
      // Temp name — renamed to hash after upload
      cb(null, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    },
  });

  upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  });
}

// GET /api/tracks
router.get('/', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;

  const tracks = db.prepare(
    'SELECT * FROM tracks ORDER BY added_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);

  res.json({ tracks, total: db.prepare('SELECT COUNT(*) as c FROM tracks').get().c });
});

// GET /api/tracks/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'Not found' });
  res.json(track);
});

// GET /api/tracks/:id/file — stream audio with range support
router.get('/:id/file', (req, res) => {
  const db = getDb();
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(tracksDir, `${track.file_hash}.${track.file_ext}`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;

  const ext = track.file_ext.toLowerCase();
  const mimeMap = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    wav: 'audio/wav',
    aiff: 'audio/aiff',
    aif: 'audio/aiff',
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : total - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': total,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// POST /api/tracks — upload track
// multipart fields: audio (file), meta (JSON string)
router.post('/', (req, res) => {
  if (!upload) return res.status(500).json({ error: 'Server not initialized' });

  upload.single('audio')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    let meta;
    try {
      meta = JSON.parse(req.body.meta || '{}');
    } catch {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid meta JSON' });
    }

    if (!meta.id) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'meta.id required' });
    }

    // Compute SHA256 of uploaded file
    const hash = await computeFileHash(req.file.path);
    const ext = (meta.file_ext || path.extname(req.file.originalname || '').slice(1) || 'mp3').toLowerCase();
    const finalPath = path.join(tracksDir, `${hash}.${ext}`);

    const db = getDb();

    // Check for duplicate by hash
    const existing = db.prepare('SELECT id FROM tracks WHERE file_hash = ?').get(hash);
    if (existing) {
      // Idempotent — clean up temp file, return existing
      fs.unlinkSync(req.file.path);
      return res.json({ id: existing.id, file_hash: hash, duplicate: true });
    }

    // Move temp file to final location
    fs.renameSync(req.file.path, finalPath);

    const track = {
      id: meta.id,
      title: meta.title || 'Unknown',
      artist: meta.artist || null,
      album: meta.album || null,
      track_no: meta.track_no || null,
      duration_ms: meta.duration_ms || null,
      file_hash: hash,
      file_ext: ext,
      cover_hash: meta.cover_hash || null,
      codec: meta.codec || null,
      sample_rate: meta.sample_rate || null,
      bitrate: meta.bitrate || null,
    };

    db.prepare(`
      INSERT OR REPLACE INTO tracks
        (id, title, artist, album, track_no, duration_ms, file_hash, file_ext, cover_hash, codec, sample_rate, bitrate)
      VALUES
        (@id, @title, @artist, @album, @track_no, @duration_ms, @file_hash, @file_ext, @cover_hash, @codec, @sample_rate, @bitrate)
    `).run(track);

    db.prepare(
      `INSERT INTO change_log (entity_type, entity_id, operation) VALUES ('track', ?, 'upsert')`
    ).run(meta.id);

    res.status(201).json({ id: meta.id, file_hash: hash });
  });
});

// DELETE /api/tracks/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(tracksDir, `${track.file_hash}.${track.file_ext}`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM tracks WHERE id = ?').run(req.params.id);
  db.prepare(
    `INSERT INTO change_log (entity_type, entity_id, operation) VALUES ('track', ?, 'delete')`
  ).run(req.params.id);

  res.json({ ok: true });
});

function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

module.exports = { router, init };
