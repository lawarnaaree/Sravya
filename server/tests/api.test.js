'use strict'

const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const supertest = require('supertest')
const path = require('path')
const os = require('os')
const fs = require('fs')

const { createApp } = require('../app')

const API_KEY = 'test-key-12345'
process.env.API_KEY = API_KEY

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sravya-test-'))

let app
let request

before(() => {
  app = createApp(TEST_DATA_DIR)
  request = supertest(app)
})

after(() => {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
})

test('GET /api/health returns 200 with ok:true', async () => {
  const res = await request.get('/api/health')
  assert.equal(res.status, 200)
  assert.equal(res.body.ok, true)
  assert.ok(res.body.time)
})

test('GET /api/tracks without auth returns 401', async () => {
  const res = await request.get('/api/tracks')
  assert.equal(res.status, 401)
})

test('GET /api/tracks with wrong token returns 401', async () => {
  const res = await request.get('/api/tracks').set('Authorization', 'Bearer wrong-key')
  assert.equal(res.status, 401)
})

test('GET /api/tracks with auth returns 200 with empty list', async () => {
  const res = await request.get('/api/tracks').set('Authorization', `Bearer ${API_KEY}`)
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.tracks, [])
  assert.equal(res.body.total, 0)
})

test('POST /api/tracks with missing meta returns 400', async () => {
  const audioPath = path.join(TEST_DATA_DIR, 'test.mp3')
  fs.writeFileSync(audioPath, Buffer.alloc(1024))

  const res = await request
    .post('/api/tracks')
    .set('Authorization', `Bearer ${API_KEY}`)
    .attach('audio', audioPath)

  assert.equal(res.status, 400)
  fs.unlinkSync(audioPath)
})

let uploadedTrackId

test('POST /api/tracks with valid data returns 201', async () => {
  const audioPath = path.join(TEST_DATA_DIR, 'track.mp3')
  fs.writeFileSync(audioPath, Buffer.from('fake-audio-data-unique-1234'))

  const meta = JSON.stringify({ title: 'Test Track', artist: 'Test Artist', album: 'Test Album' })

  const res = await request
    .post('/api/tracks')
    .set('Authorization', `Bearer ${API_KEY}`)
    .attach('audio', audioPath, 'track.mp3')
    .field('meta', meta)

  assert.equal(res.status, 201)
  assert.ok(res.body.id)
  assert.ok(res.body.file_hash)
  assert.equal(res.body.duplicate, false)

  uploadedTrackId = res.body.id
  fs.unlinkSync(audioPath)
})

test('POST /api/tracks same file returns duplicate:true', async () => {
  const audioPath = path.join(TEST_DATA_DIR, 'track2.mp3')
  fs.writeFileSync(audioPath, Buffer.from('fake-audio-data-unique-1234'))

  const meta = JSON.stringify({ title: 'Test Track Dupe', artist: 'Test Artist' })

  const res = await request
    .post('/api/tracks')
    .set('Authorization', `Bearer ${API_KEY}`)
    .attach('audio', audioPath, 'track2.mp3')
    .field('meta', meta)

  assert.equal(res.status, 200)
  assert.equal(res.body.duplicate, true)

  fs.unlinkSync(audioPath)
})

test('GET /api/tracks returns the uploaded track', async () => {
  const res = await request.get('/api/tracks').set('Authorization', `Bearer ${API_KEY}`)
  assert.equal(res.status, 200)
  assert.equal(res.body.tracks.length, 1)
  assert.equal(res.body.total, 1)
  assert.equal(res.body.tracks[0].title, 'Test Track')
})

test('GET /api/tracks/:id returns track metadata', async () => {
  const res = await request.get(`/api/tracks/${uploadedTrackId}`).set('Authorization', `Bearer ${API_KEY}`)
  assert.equal(res.status, 200)
  assert.equal(res.body.id, uploadedTrackId)
  assert.equal(res.body.artist, 'Test Artist')
})

test('GET /api/tracks/nonexistent returns 404', async () => {
  const res = await request.get('/api/tracks/nonexistent-id').set('Authorization', `Bearer ${API_KEY}`)
  assert.equal(res.status, 404)
})

test('GET /api/sync/changes without since returns upsert entry', async () => {
  const res = await request.get('/api/sync/changes').set('Authorization', `Bearer ${API_KEY}`)
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body.changes))
  assert.ok(res.body.changes.length > 0)
  const entry = res.body.changes[0]
  assert.equal(entry.entityType, 'track')
  assert.equal(entry.operation, 'upsert')
  assert.ok(res.body.serverTime)
})

test('GET /api/sync/changes?since=future returns empty', async () => {
  const future = new Date(Date.now() + 60000).toISOString()
  const res = await request
    .get(`/api/sync/changes?since=${future}`)
    .set('Authorization', `Bearer ${API_KEY}`)
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.changes, [])
})

test('DELETE /api/tracks/:id returns 200 and logs delete', async () => {
  const res = await request.delete(`/api/tracks/${uploadedTrackId}`).set('Authorization', `Bearer ${API_KEY}`)
  assert.equal(res.status, 200)
  assert.equal(res.body.ok, true)

  const changes = await request.get('/api/sync/changes').set('Authorization', `Bearer ${API_KEY}`)
  const deleteEntry = changes.body.changes.find(c => c.operation === 'delete' && c.entityId === uploadedTrackId)
  assert.ok(deleteEntry, 'delete entry should be in change_log')
})

test('GET /nonexistent-route returns 404', async () => {
  const res = await request.get('/nonexistent-route')
  assert.equal(res.status, 404)
})
