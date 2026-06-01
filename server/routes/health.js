'use strict'

const { Router } = require('express')
const router = Router()

router.get('/', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

module.exports = router
