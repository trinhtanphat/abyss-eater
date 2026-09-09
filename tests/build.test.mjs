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

test('embedded client negotiates protocol v1 and resumes the same room presence', () => {
  const result = build();
  assert.equal(result.status, 0, `build must succeed:\n${result.stdout}\n${result.stderr}`);
  const worker = readFileSync('dist/worker.mjs', 'utf8');
  for (const marker of [
    'const PROTOCOL_VERSION = 1;',
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

test('embedded client uses a capability-aware bootstrap with explicit system states', () => {
  const result = build();
  assert.equal(result.status, 0, `build must succeed:\n${result.stdout}\n${result.stderr}`);
  const worker = readFileSync('dist/worker.mjs', 'utf8');
  for (const marker of [
    'data-app-state=\\"loading\\"',
    'id=\\"loading-screen\\"',
    'id=\\"unsupported-screen\\"',
    '"/bootstrap.js":',
    '"/client-capabilities.mjs":',
    "await import('/app.js')",
    'webgl_unavailable',
  ]) {
    assert.ok(worker.includes(marker), `capability bootstrap bundle must include ${marker}`);
  }
});

test('embedded client exposes accessible quality and reduced-effects settings without changing protocol', () => {
  const result = build();
  assert.equal(result.status, 0, `build must succeed:\n${result.stdout}\n${result.stderr}`);
  const worker = readFileSync('dist/worker.mjs', 'utf8');
  for (const marker of [
    '"/client-settings.mjs":',
    'id=\\"settings-dialog\\"',
    'id=\\"quality-setting\\"',
    'id=\\"reduced-effects-setting\\"',
    'value=\\"auto\\"',
    'value=\\"low\\"',
    'value=\\"medium\\"',
    'value=\\"high\\"',
    'abyss-eater-settings-v1',
    'prefers-reduced-motion',
    'pixelRatioCap',
    'v: PROTOCOL_VERSION',
  ]) {
    assert.ok(worker.includes(marker), `settings bundle must include ${marker}`);
  }
});

test('embedded client audio is gesture-gated local Web Audio without external media assets', () => {
  const result = build();
  assert.equal(result.status, 0, `build must succeed:\n${result.stdout}\n${result.stderr}`);
  const worker = readFileSync('dist/worker.mjs', 'utf8');
  for (const marker of [
    '"/client-audio.mjs":',
    'AudioContext',
    'visibilitychange',
    'playDeath',
    'playEat',
    'startAmbience',
  ]) {
    assert.ok(worker.includes(marker), `audio bundle must include ${marker}`);
  }
  for (const extension of ['.mp3', '.ogg', '.wav']) {
    assert.equal(worker.includes(extension), false, `audio bundle must not load external ${extension} assets`);
  }
});
