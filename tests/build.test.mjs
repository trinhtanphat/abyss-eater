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
    '\"/\":',
    '\"/app.js\":',
    '\"/styles.css\":',
    '\"/manifest.webmanifest\":',
    '\"/game/presentation.js\":',
    '\"/game/themes.js\":',
    '\"/game/fish.js\":',
    '\"/ui/hud.js\":',
    '\"/ui/lobby.js\":',
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
