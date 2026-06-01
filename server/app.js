'use strict'

const express = require('express')
const path = require('path')
const { createDatabase } = require('./db/database')
const { requireAuth } = require('./middleware/auth')
const healthRouter = require('./routes/health')
const { createRouter: createTracksRouter } = require('./routes/tracks')
const { createRouter: createCoversRouter } = require('./routes/covers')
const { createRouter: createSyncRouter } = require('./routes/sync')

function createApp(dataDir) {
  const db = createDatabase(dataDir)
  const app = express()

  app.use(express.json({ limit: '10mb' }))

  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length')
    if (_req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  app.use('/api/health', healthRouter)
  app.use('/api/tracks', requireAuth, createTracksRouter(db, dataDir))
  app.use('/api/covers', requireAuth, createCoversRouter(db, dataDir))
  app.use('/api/sync', requireAuth, createSyncRouter(db))

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  return app
}

module.exports = { createApp }
