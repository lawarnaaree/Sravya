'use strict'

const { Router } = require('express')
const multer = require('multer')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')

const COVER_EXTS = ['jpg', 'jpeg', 'png', 'webp']

function createRouter(_db, dataDir) {
  const router = Router()
  const coversDir = path.join(dataDir, 'uploads', 'covers')
  const tmpDir = path.join(dataDir, 'tmp')
  fs.mkdirSync(coversDir, { recursive: true })
  fs.mkdirSync(tmpDir, { recursive: true })

  const storage = multer.diskStorage({
    destination: tmpDir,
    filename: (_req, _file, cb) => cb(null, `cover_${Date.now()}_${Math.random().toString(36).slice(2)}`),
  })
  const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

  function sha256File(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  router.get('/:hash', (req, res) => {
    for (const ext of COVER_EXTS) {
      const filePath = path.join(coversDir, `${req.params.hash}.${ext}`)
      if (fs.existsSync(filePath)) {
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp'
        res.setHeader('Content-Type', mime)
        res.setHeader('Cache-Control', 'public, max-age=31536000')
        return fs.createReadStream(filePath).pipe(res)
      }
    }
    res.status(404).json({ error: 'Not found' })
  })

  router.post('/', upload.single('cover'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Missing cover file' })

    const tmpFile = req.file.path
    const origName = req.file.originalname
    const ext = path.extname(origName).slice(1).toLowerCase() || 'jpg'

    try {
      const hash = await sha256File(tmpFile)
      const finalPath = path.join(coversDir, `${hash}.${ext}`)

      if (fs.existsSync(finalPath)) {
        fs.unlink(tmpFile, () => {})
        return res.json({ hash })
      }

      fs.renameSync(tmpFile, finalPath)
      res.json({ hash })
    } catch (err) {
      fs.unlink(tmpFile, () => {})
      console.error('Cover upload error:', err)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  return router
}

module.exports = { createRouter }
