'use strict'

require('dotenv').config()

const { createApp } = require('./app')

if (!process.env.API_KEY) {
  console.error('ERROR: API_KEY environment variable is required')
  process.exit(1)
}

const PORT = parseInt(process.env.PORT) || 3000
const DATA_DIR = process.env.DATA_DIR || __dirname

const app = createApp(DATA_DIR)

app.listen(PORT, () => {
  console.log(`Sravya API listening on port ${PORT}`)
})
