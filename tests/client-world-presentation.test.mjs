import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as biomes from '../public/game/biomes.js';

test('client biome palette has four canonical presentation-only ids', () => {
  assert.deepEqual(biomes.BIOME_VISUAL_IDS, ['surface', 'reef', 'deep', 'abyss']);
  assert.equal(biomes.biomeVisual('missing').id, 'reef');
});

test('client preserves world arrays across player-only delta snapshots', () => {
  const state = readFileSync('public/game/state.js', 'utf8');
  assert.ok(state.includes('nextHazards'));
  assert.ok(state.includes('nextPickups'));
});

test('HUD and shell expose current biome and cache world presentation modules', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const app = readFileSync('public/app.js', 'utf8');
  const sw = readFileSync('public/sw.js', 'utf8');
  assert.ok(html.includes('id="hud-biome"'));
  assert.ok(app.includes('createHazardMesh'));
  assert.ok(app.includes('createPickupMesh'));
  assert.ok(sw.includes("'/game/biomes.js'"));
  assert.ok(sw.includes("'/game/world-actors.js'"));
});