const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = Router();

let coversDir;
let upload;

function init(dataDir) {
  coversDir = path.join(dataDir, 'uploads', 'covers');
  fs.mkdirSync(coversDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, coversDir),
    filename: (_req, _file, cb) => {
      cb(null, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    },
  });

  upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB max
}

// GET /api/covers/:hash
router.get('/:hash', (req, res) => {
  const hash = req.params.hash;
  // Try common image extensions
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    const filePath = path.join(coversDir, `${hash}.${ext}`);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  res.status(404).json({ error: 'Not found' });
});

// POST /api/covers — upload cover art
// Returns { cover_hash } — idempotent by content hash
router.post('/', (req, res) => {
  if (!upload) return res.status(500).json({ error: 'Server not initialized' });

  upload.single('cover')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No cover file' });

    const hash = await computeFileHash(req.file.path);
    const ext = (path.extname(req.file.originalname || '').slice(1) || 'jpg').toLowerCase();
    const finalPath = path.join(coversDir, `${hash}.${ext}`);

    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(req.file.path);
    } else {
      fs.renameSync(req.file.path, finalPath);
    }

    res.json({ cover_hash: hash });
  });
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
