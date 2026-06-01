const { Router } = require('express');
const router = Router();

router.get('/', (_req, res) => {
  res.json({ ok: true, service: 'sravya-api' });
});

module.exports = router;
