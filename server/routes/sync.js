'use strict'

const { Router } = require('express')

function createRouter(db) {
  const router = Router()

  router.get('/changes', (req, res) => {
    const since = req.query.since
    const serverTime = new Date().toISOString()

    let rows
    if (since) {
      rows = db.prepare(
        `SELECT seq, entity_type, entity_id, operation, occurred_at
         FROM change_log
         WHERE occurred_at > ?
         ORDER BY seq ASC
         LIMIT 1000`
      ).all(since)
    } else {
      rows = db.prepare(
        `SELECT seq, entity_type, entity_id, operation, occurred_at
         FROM change_log
         ORDER BY seq ASC
         LIMIT 1000`
      ).all()
    }

    const changes = rows.map(row => ({
      seq: row.seq,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      occurredAt: row.occurred_at,
    }))

    res.json({ changes, serverTime })
  })

  return router
}

module.exports = { createRouter }
