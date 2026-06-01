'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const supertest = require('supertest');

// Use a temp directory so tests never touch the real data
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sravya-test-'));
const TEST_API_KEY = 'test-key-12345';

// Set env before requiring app (modules cache, so order matters)
process.env.API_KEY = TEST_API_KEY;
process.env.DATA_DIR = TEST_DATA_DIR;

const { createApp } = require('../app');

let app;
let request;

before(() => {
  app = createApp(TEST_DATA_DIR);
  request = supertest(app);
});

after(() => {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

// ── Health ─────────────────────────────────────────────────────────────────

test('GET /api/health returns ok without auth', async () => {
  const res = await request.get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.service, 'sravya-api');
});

// ── Auth ───────────────────────────────────────────────────────────────────

test('GET /api/tracks without auth returns 401', async () => {
  const res = await request.get('/api/tracks');
  assert.equal(res.status, 401);
});

test('GET /api/tracks with wrong key returns 401', async () => {
  const res = await request.get('/api/tracks').set('Authorization', 'Bearer wrong-key');
  assert.equal(res.status, 401);
});

test('GET /api/sync/changes without auth returns 401', async () => {
  const res = await request.get('/api/sync/changes');
  assert.equal(res.status, 401);
});

// ── Tracks listing ─────────────────────────────────────────────────────────

test('GET /api/tracks returns empty list on fresh DB', async () => {
  const res = await request
    .get('/api/tracks')
    .set('Authorization', `Bearer ${TEST_API_KEY}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.tracks));
  assert.equal(res.body.tracks.length, 0);
  assert.equal(res.body.total, 0);
});

test('GET /api/tracks/:id returns 404 for missing track', async () => {
  const res = await request
    .get('/api/tracks/nonexistent-id')
    .set('Authorization', `Bearer ${TEST_API_KEY}`);
  assert.equal(res.status, 404);
});

// ── Track upload ───────────────────────────────────────────────────────────

test('POST /api/tracks uploads a track and returns id + hash', async () => {
  // Create a minimal fake MP3 (just bytes, not a real audio file — sufficient for upload test)
  const fakeAudio = Buffer.alloc(1024, 0xff);
  const meta = JSON.stringify({
    id: 'test-track-001',
    title: 'Test Track',
    artist: 'Test Artist',
    album: 'Test Album',
    duration_ms: 180000,
    file_ext: 'mp3',
  });

  const res = await request
    .post('/api/tracks')
    .set('Authorization', `Bearer ${TEST_API_KEY}`)
    .attach('audio', fakeAudio, { filename: 'test.mp3', contentType: 'audio/mpeg' })
    .field('meta', meta);

  assert.equal(res.status, 201);
  assert.equal(res.body.id, 'test-track-001');
  assert.ok(typeof res.body.file_hash === 'string');
  assert.equal(res.body.file_hash.length, 64); // SHA256 hex
});

test('POST /api/tracks is idempotent — same file returns duplicate:true', async () => {
  const fakeAudio = Buffer.alloc(1024, 0xff); // same bytes as above
  const meta = JSON.stringify({
    id: 'test-track-002',
    title: 'Duplicate Track',
    artist: 'Artist',
    album: 'Album',
    duration_ms: 60000,
    file_ext: 'mp3',
  });

  const res = await request
    .post('/api/tracks')
    .set('Authorization', `Bearer ${TEST_API_KEY}`)
    .attach('audio', fakeAudio, { filename: 'dup.mp3', contentType: 'audio/mpeg' })
    .field('meta', meta);

  assert.equal(res.status, 200);
  assert.equal(res.body.duplicate, true);
});

test('POST /api/tracks without meta returns 400', async () => {
  const fakeAudio = Buffer.alloc(512, 0xaa);
  const res = await request
    .post('/api/tracks')
    .set('Authorization', `Bearer ${TEST_API_KEY}`)
    .attach('audio', fakeAudio, { filename: 'x.mp3', contentType: 'audio/mpeg' });
  // meta missing → id missing → 400
  assert.equal(res.status, 400);
});

// ── Track listing after upload ─────────────────────────────────────────────

test('GET /api/tracks lists uploaded track', async () => {
  const res = await request
    .get('/api/tracks')
    .set('Authorization', `Bearer ${TEST_API_KEY}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.tracks.some((t) => t.id === 'test-track-001'));
});

test('GET /api/tracks/:id returns metadata for uploaded track', async () => {
  const res = await request
    .get('/api/tracks/test-track-001')
    .set('Authorization', `Bearer ${TEST_API_KEY}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'Test Track');
  assert.equal(res.body.artist, 'Test Artist');
});

// ── Sync changes ───────────────────────────────────────────────────────────

test('GET /api/sync/changes returns changes after upload', async () => {
  const res = await request
    .get('/api/sync/changes?since=1970-01-01T00:00:00Z')
    .set('Authorization', `Bearer ${TEST_API_KEY}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.changes));
  assert.ok(res.body.changes.length >= 1);
  assert.ok(res.body.changes.some((c) => c.entityId === 'test-track-001'));
  assert.ok(typeof res.body.serverTime === 'string');
});

test('GET /api/sync/changes with future since returns empty', async () => {
  const res = await request
    .get('/api/sync/changes?since=2099-01-01T00:00:00Z')
    .set('Authorization', `Bearer ${TEST_API_KEY}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.changes.length, 0);
});

// ── Delete ─────────────────────────────────────────────────────────────────

test('DELETE /api/tracks/:id removes track and adds delete to change_log', async () => {
  const del = await request
    .delete('/api/tracks/test-track-001')
    .set('Authorization', `Bearer ${TEST_API_KEY}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.ok, true);

  const get = await request
    .get('/api/tracks/test-track-001')
    .set('Authorization', `Bearer ${TEST_API_KEY}`);
  assert.equal(get.status, 404);

  // change_log should now have a delete entry
  const changes = await request
    .get('/api/sync/changes?since=1970-01-01T00:00:00Z')
    .set('Authorization', `Bearer ${TEST_API_KEY}`);
  assert.ok(
    changes.body.changes.some(
      (c) => c.entityId === 'test-track-001' && c.operation === 'delete',
    ),
  );
});

// ── 404 catch-all ──────────────────────────────────────────────────────────

test('Unknown route returns 404 JSON', async () => {
  const res = await request
    .get('/api/nonexistent')
    .set('Authorization', `Bearer ${TEST_API_KEY}`);
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});
