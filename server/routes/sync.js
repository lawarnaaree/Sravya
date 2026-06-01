const { Router } = require('express');
const { getDb } = require('../db/database');

const router = Router();

// GET /api/sync/changes?since=<ISO timestamp>
// Returns delta log entries since the given timestamp — same shape as LAN sync /sync/changes
router.get('/changes', (req, res) => {
  const db = getDb();
  const since = req.query.since || '1970-01-01T00:00:00Z';

  const changes = db.prepare(
    `SELECT seq, entity_type as entityType, entity_id as entityId, operation, occurred_at as occurredAt
     FROM change_log
     WHERE occurred_at > ?
     ORDER BY seq ASC
     LIMIT 1000`
  ).all(since);

  res.json({
    changes,
    serverTime: new Date().toISOString(),
  });
});

module.exports = router;
