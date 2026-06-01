'use strict'

const { Router } = require('express')
const multer = require('multer')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('crypto')

const AUDIO_EXTS = new Set(['mp3', 'm4a', 'flac', 'ogg', 'opus', 'wav', 'aiff'])
const MIME_MAP = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg; codecs=opus',
  wav: 'audio/wav',
  aiff: 'audio/aiff',
}

function createRouter(db, dataDir) {
  const router = Router()
  const tracksDir = path.join(dataDir, 'uploads', 'tracks')
  const tmpDir = path.join(dataDir, 'tmp')
  fs.mkdirSync(tracksDir, { recursive: true })
  fs.mkdirSync(tmpDir, { recursive: true })

  const storage = multer.diskStorage({
    destination: tmpDir,
    filename: (_req, _file, cb) => cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`),
  })
  const upload = multer({
    storage,
    limits: { fileSize: 250 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.fieldname === 'audio') {
        const ext = path.extname(file.originalname).slice(1).toLowerCase()
        cb(null, AUDIO_EXTS.has(ext))
      } else {
        cb(null, true)
      }
    },
  })

  function sha256File(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  router.get('/', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50))
    const offset = (page - 1) * limit

    const tracks = db.prepare('SELECT * FROM tracks ORDER BY added_at DESC LIMIT ? OFFSET ?').all(limit, offset)
    const { total } = db.prepare('SELECT COUNT(*) as total FROM tracks').get()

    res.json({ tracks, total, page, limit })
  })

  router.get('/:id', (req, res) => {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id)
    if (!track) return res.status(404).json({ error: 'Not found' })
    res.json(track)
  })

  router.get('/:id/file', (req, res) => {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id)
    if (!track) return res.status(404).json({ error: 'Not found' })

    const filePath = path.join(tracksDir, `${track.file_hash}.${track.file_ext}`)
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' })

    const stat = fs.statSync(filePath)
    const fileSize = stat.size
    const mime = MIME_MAP[track.file_ext] || 'audio/mpeg'
    const rangeHeader = req.headers['range']

    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1
      const chunkSize = end - start + 1

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
      })
      fs.createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': mime,
      })
      fs.createReadStream(filePath).pipe(res)
    }
  })

  router.post('/', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'meta', maxCount: 1 }]), async (req, res) => {
    const files = req.files
    if (!files || !files['audio'] || !files['audio'][0]) {
      return res.status(400).json({ error: 'Missing audio file' })
    }

    let meta
    try {
      const metaStr = req.body.meta
      if (!metaStr) throw new Error('Missing meta field')
      meta = JSON.parse(metaStr)
    } catch {
      const tmpFile = files['audio'][0].path
      fs.unlink(tmpFile, () => {})
      return res.status(400).json({ error: 'Invalid or missing meta JSON' })
    }

    const tmpFile = files['audio'][0].path
    const origName = files['audio'][0].originalname
    const ext = path.extname(origName).slice(1).toLowerCase() || 'mp3'

    try {
      const fileHash = await sha256File(tmpFile)
      const existing = db.prepare('SELECT id, file_hash FROM tracks WHERE file_hash = ?').get(fileHash)

      if (existing) {
        fs.unlink(tmpFile, () => {})
        return res.json({ id: existing.id, file_hash: existing.file_hash, duplicate: true })
      }

      const finalPath = path.join(tracksDir, `${fileHash}.${ext}`)
      fs.renameSync(tmpFile, finalPath)

      const id = crypto.randomUUID()
      db.prepare(`
        INSERT INTO tracks (id, title, artist, album, track_no, duration_ms, file_hash, file_ext, cover_hash, codec, sample_rate, bitrate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        meta.title || origName,
        meta.artist || null,
        meta.album || null,
        meta.trackNo || meta.track_no || null,
        meta.durationMs || meta.duration_ms || null,
        fileHash,
        ext,
        meta.coverHash || meta.cover_hash || null,
        meta.codec || null,
        meta.sampleRate || meta.sample_rate || null,
        meta.bitrate || null,
      )

      db.prepare(`INSERT INTO change_log (entity_type, entity_id, operation) VALUES ('track', ?, 'upsert')`).run(id)

      return res.status(201).json({ id, file_hash: fileHash, duplicate: false })
    } catch (err) {
      fs.unlink(tmpFile, () => {})
      console.error('Upload error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  })

  router.delete('/:id', (req, res) => {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id)
    if (!track) return res.status(404).json({ error: 'Not found' })

    const filePath = path.join(tracksDir, `${track.file_hash}.${track.file_ext}`)
    try { fs.unlinkSync(filePath) } catch { /* already gone */ }

    db.prepare('DELETE FROM tracks WHERE id = ?').run(req.params.id)
    db.prepare(`INSERT INTO change_log (entity_type, entity_id, operation) VALUES ('track', ?, 'delete')`).run(req.params.id)

    res.json({ ok: true })
  })

  return router
}

module.exports = { createRouter }
