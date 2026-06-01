const express = require('express');
const path = require('path');

const { initDb } = require('./db/database');
const { requireAuth } = require('./middleware/auth');
const healthRouter = require('./routes/health');
const tracksModule = require('./routes/tracks');
const coversModule = require('./routes/covers');
const syncRouter = require('./routes/sync');

function createApp(dataDir) {
  const dir = dataDir || process.env.DATA_DIR || path.join(__dirname);

  initDb(dir);
  tracksModule.init(dir);
  coversModule.init(dir);

  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Accept-Ranges,Content-Length');
    if (_req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use('/api/health', healthRouter);
  app.use('/api/tracks', requireAuth, tracksModule.router);
  app.use('/api/covers', requireAuth, coversModule.router);
  app.use('/api/sync', requireAuth, syncRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  return app;
}

module.exports = { createApp };
