import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function build() {
  return spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8' });
}

function builtWorker() {
  const result = build();
  assert.equal(result.status, 0, `build must succeed:\n${result.stdout}\n${result.stderr}`);
  return readFileSync('dist/worker.mjs', 'utf8');
}

test('production Worker bundle contains hardened multiplayer protocol, capability bootstrap, PWA and modular assets', () => {
  const worker = builtWorker();
  for (const marker of [
    'export class GameRoom',
    'this.ctx.acceptWebSocket(server)',
    "url.pathname === '/health'",
    "url.pathname === '/ws'",
    '"/":',
    '"/bootstrap.js":',
    '"/app.js":',
    '"/styles.css":',
    '"/themes.css":',
    '"/polish.css":',
    '"/manifest.webmanifest":',
    '"/sw.js":',
    '"/icon-192.svg":',
    '"/icon-512.svg":',
    '"/client-input.mjs":',
    '"/client-settings.mjs":',
    '"/client-audio.mjs":',
    '"/client-capabilities.mjs":',
    '"/game/presentation.js":',
    '"/game/themes.js":',
    '"/game/fish.js":',
    '"/game/network.js":',
    '"/ui/client-polish.js":',
    '"/ui/hud.js":',
    '"/ui/lobby.js":',
    'GAME_ROOM.getByName',
    'serializeAttachment',
  ]) assert.ok(worker.includes(marker), `bundle must include ${marker}`);
});

test('embedded client contains pinned 3D renderer, premium HUD, touch controls and realtime connection', () => {
  const worker = builtWorker();
  for (const marker of [
    'cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js',
    'id=\\"hud-mass\\"',
    'id=\\"touch-controls\\"',
    'id=\\"quality-select\\"',
    'id=\\"leaderboard\\"',
    'id=\\"depth-meter\\"',
    'id=\\"touch-joystick\\"',
    'id=\\"connection-banner\\"',
    'id=\\"respawn-card\\"',
    'new WebSocket',
    "new URL('/ws'",
    'Abyss Eater: Ocean Survival',
    'createOceanEnvironment',
    'createFishRig',
    'createEffectManager',
    'createInputController',
    'createNetworkClient',
    'createClientPolish',
    'prefers-reduced-motion',
  ]) assert.ok(worker.includes(marker), `client bundle must include ${marker}`);
});

test('embedded client preserves desktop mouse-look and camera-relative controls', () => {
  const worker = builtWorker();
  for (const marker of [
    'cameraRelativeDirection',
    'requestPointerLock',
    'pointerLockElement',
    'Mouse look',
  ]) assert.ok(worker.includes(marker), `desktop controls bundle must include ${marker}`);
});

test('embedded client negotiates protocol v2, resumes presence and fails closed on mismatch', () => {
  const worker = builtWorker();
  for (const marker of [
    'const PROTOCOL_VERSION = 2;',
    'VERSIONED_MESSAGE_TYPES',
    'sessionStorage',
    "wsUrl.searchParams.set('resume'",
    'v: PROTOCOL_VERSION',
    'message.v !== PROTOCOL_VERSION',
    'message.resumeKey',
    'message.inputSeq',
    'message.resumed',
    'Reconnected to your fish',
    'Upgrade required',
  ]) assert.ok(worker.includes(marker), `versioned reconnect client must include ${marker}`);
});

test('phase B keeps stylized default and ships switchable realistic deep sea presentation', () => {
  const worker = builtWorker();
  for (const marker of [
    'const DEEP_SEA',
    "'deep-sea': DEEP_SEA",
    'id=\\"settings-theme-select\\"',
    'id=\\"settings-quality-select\\"',
    'data-theme=\\"stylized\\"',
    'html[data-theme=\\"deep-sea\\"]',
    'shaftOpacity',
    'planktonSize',
  ]) assert.ok(worker.includes(marker), `deep sea bundle must include ${marker}`);
});
