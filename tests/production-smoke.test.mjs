import test from 'node:test';
import assert from 'node:assert/strict';
import * as smoke from '../scripts/production-smoke.mjs';
import {
  PROTOCOL_VERSION,
  PLAYER_COUNT,
  CRITICAL_ASSETS,
  healthLooksReady,
  validateWelcome,
  buildWsUrl,
  normalizeStaticText,
} from '../scripts/production-smoke.mjs';

test('production smoke keeps the current four-player protocol-v2 client contract', () => {
  assert.equal(PROTOCOL_VERSION, 2);
  assert.equal(PLAYER_COUNT, 4);
  for (const asset of [
    '/styles.css',
    '/client-progression.mjs',
    '/client-tts.mjs',
    '/app.js',
    '/game/state.js',
    '/game/input.js',
    '/game/network.js',
    '/game/scene.js',
    '/game/biomes.js',
    '/game/world-actors.js',
    '/game/fish.js',
    '/game/fish-skins.mjs',
  ]) {
    assert.ok(CRITICAL_ASSETS.includes(asset), `missing critical asset ${asset}`);
  }
});

test('health validator requires the live Carrier 4 authoritative contract', () => {
  const ready = {
    ok: true,
    version: '0.3.0',
    protocolVersion: 2,
    roomPoolSize: 64,
    snapshotHzCap: 20,
    wildlifePerRoom: 24,
    biomes: 4,
    hazardsPerRoom: 8,
    pickupsPerRoom: 12,
  };
  assert.equal(healthLooksReady(ready), true);
  assert.equal(healthLooksReady({ ...ready, protocolVersion: 1 }), false);
  assert.equal(healthLooksReady({ ...ready, hazardsPerRoom: 7 }), false);
});

test('welcome validator requires resume-capable world state', () => {
  const message = {
    type: 'welcome', v: 2, id: 'abc123', room: 'room-1',
    resumeKey: 'opaque-key', resumed: false, inputSeq: 0,
    snapshot: { players: [], wildlife: [], food: [], hazards: [], pickups: [] },
  };
  assert.doesNotThrow(() => validateWelcome(message));
  assert.throws(() => validateWelcome({ ...message, v: 1 }), /protocol/i);
  assert.throws(() => validateWelcome({ ...message, resumeKey: '' }), /resume/i);
  assert.throws(() => validateWelcome({ ...message, snapshot: { players: [] } }), /world/i);
});

test('boost smoke input stays protocol-v2 and boolean-only', () => {
  assert.equal(typeof smoke.buildInputMessage, 'function');
  const buildInputMessage = smoke.buildInputMessage;
  assert.deepEqual(
    buildInputMessage(9, { x: 0.35, y: 0, z: 0.2 }, true),
    { type: 'input', v: 2, seq: 9, dir: { x: 0.35, y: 0, z: 0.2 }, boost: true },
  );
  assert.deepEqual(
    buildInputMessage(10, { x: 0, y: 0, z: 0 }, false),
    { type: 'input', v: 2, seq: 10, dir: { x: 0, y: 0, z: 0 }, boost: false },
  );
});

test('websocket URL carries bounded smoke identity and optional resume key', () => {
  const url = buildWsUrl('https://abyss-eater.qs3d.site', {
    name: 'Smoke Fish 1', room: 'smoke-room', resumeKey: 'resume_abc',
  });
  assert.equal(url.protocol, 'wss:');
  assert.equal(url.pathname, '/ws');
  assert.equal(url.searchParams.get('name'), 'Smoke Fish 1');
  assert.equal(url.searchParams.get('room'), 'smoke-room');
  assert.equal(url.searchParams.get('resume'), 'resume_abc');
});
test('static parity normalizes transport-neutral BOM and line endings', () => {
  assert.equal(normalizeStaticText('a\r\nb\r\n'), 'a\nb\n');
  assert.equal(normalizeStaticText('a\nb\n'), 'a\nb\n');
  assert.equal(normalizeStaticText('\uFEFFa\r\nb\r\n'), 'a\nb\n');
});
