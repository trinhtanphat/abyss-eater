import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function build() {
  return spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8' });
}

test('production Worker bundle contains multiplayer room protocol and embedded assets', () => {
  const result = build();
  assert.equal(result.status, 0, `build must succeed:\n${result.stdout}\n${result.stderr}`);
  const worker = readFileSync('dist/worker.mjs', 'utf8');
  for (const marker of [
    'export class GameRoom',
    'this.ctx.acceptWebSocket(server)',
    "url.pathname === '/health'",
    "url.pathname === '/ws'",
    '"/":',
    '"/app.js":',
    '"/styles.css":',
    '"/manifest.webmanifest":',
    '"/sw.js":',
    '"/icon-192.svg":',
    '"/icon-512.svg":',
    'GAME_ROOM.getByName',
    'serializeAttachment',
  ]) {
    assert.ok(worker.includes(marker), `bundle must include ${marker}`);
  }
});

test('embedded client contains pinned 3D renderer, HUD, touch controls and realtime connection', () => {
  const result = build();
  assert.equal(result.status, 0, `build must succeed:\n${result.stdout}\n${result.stderr}`);
  const worker = readFileSync('dist/worker.mjs', 'utf8');
  for (const marker of [
    'cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js',
    'id=\\"hud-mass\\"',
    'id=\\"touch-controls\\"',
    'new WebSocket',
    "new URL('/ws'",
    'Abyss Eater: Ocean Survival',
  ]) {
    assert.ok(worker.includes(marker), `client bundle must include ${marker}`);
  }
});

test('embedded client exposes desktop mouse-look and camera-relative keyboard controls', () => {
  const result = build();
  assert.equal(result.status, 0, `build must succeed:\n${result.stdout}\n${result.stderr}`);
  const worker = readFileSync('dist/worker.mjs', 'utf8');
  for (const marker of [
    '"/client-input.mjs":',
    'cameraRelativeDirection',
    'requestPointerLock',
    'pointerLockElement',
    'Mouse look',
  ]) {
    assert.ok(worker.includes(marker), `desktop controls bundle must include ${marker}`);
  }
});

test('embedded client negotiates protocol v2 and resumes the same room presence', () => {
  const result = build();
  assert.equal(result.status, 0, `build must succeed:\n${result.stdout}\n${result.stderr}`);
  const worker = readFileSync('dist/worker.mjs', 'utf8');
  for (const marker of [
    'const PROTOCOL_VERSION = 2;',
    'sessionStorage',
    "wsUrl.searchParams.set('resume'",
    'v: PROTOCOL_VERSION',
    'message.v !== PROTOCOL_VERSION',
    'message.resumeKey',
    'message.resumed',
    'inputSeq: player.seq',
    'message.inputSeq',
    'Reconnected to your fish',
    'Upgrade required',
  ]) {
    assert.ok(worker.includes(marker), `versioned reconnect client must include ${marker}`);
  }
});
