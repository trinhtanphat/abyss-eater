import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leaderboard } from '../public/game/presentation.js';
import * as smoke from '../scripts/production-smoke.mjs';
const { CRITICAL_ASSETS } = smoke;

const gameLogic = await import('../src/game-logic.mjs');
const evolution = await import('../public/game/fish-evolution.mjs');

function requireFn(module, name) {
  assert.equal(typeof module[name], 'function', `${name} must be exported`);
  return module[name];
}

test('Fish Level follows the six mass-driven evolution tiers on server and client', () => {
  const serverLevel = requireFn(gameLogic, 'fishLevelForMass');
  const clientLevel = requireFn(evolution, 'fishLevelForMass');
  const masses = [0.2, 1, 1.99, 2, 4, 8, 16, 32, 10_000];
  const expected = [1, 1, 1, 2, 3, 4, 5, 6, 6];
  assert.deepEqual(masses.map(serverLevel), expected);
  assert.deepEqual(masses.map(clientLevel), expected);
});

test('Fish Level falls back safely to level one for invalid mass', () => {
  const serverLevel = requireFn(gameLogic, 'fishLevelForMass');
  for (const mass of [undefined, null, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(serverLevel(mass), 1);
  }
});

test('authoritative snapshots publish Fish Level for players and wildlife', async () => {
  const worker = await readFile('src/worker.template.mjs', 'utf8');
  const player = worker.match(/function publicPlayer\(player\) \{[\s\S]*?\n\}/)?.[0] || '';
  const wildlife = worker.match(/function publicWildlife\(actor\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(player.includes('fishLevel: fishLevelForMass(player.mass)'));
  assert.ok(wildlife.includes('fishLevel: fishLevelForMass(actor.mass)'));
});

test('renderer uses snapshot Fish Level to choose the evolution silhouette', async () => {
  const fish = await readFile('public/game/fish.js', 'utf8');
  assert.ok(fish.includes('data.fishLevel'));
  assert.ok(fish.includes('silhouetteForLevel'));
  assert.ok(fish.includes('player.fishLevel'));
  assert.ok(fish.includes('applyEvolutionSilhouette(rig, data.fishLevel)'));
});

test('leaderboard preserves Fish Level for every player row', () => {
  const rows = leaderboard([
    { id: 'a', name: 'A', score: 9, mass: 8, fishLevel: 4 },
    { id: 'b', name: 'B', score: 4, mass: 2, fishLevel: 2 },
  ], 'a', 5);
  assert.deepEqual(rows.map((row) => row.fishLevel), [4, 2]);
});

test('HUD shows local Fish Level and leaderboard shows every player level', async () => {
  const hud = await readFile('public/ui/hud.js', 'utf8');
  assert.ok(hud.includes('Fish Lv.${fishLevel}'));
  assert.ok(hud.includes('Lv.${row.fishLevel}'));
});

test('production smoke validates Fish Level and all changed client assets', () => {
  assert.ok(CRITICAL_ASSETS.includes('/game/fish-evolution.mjs'));
  assert.ok(CRITICAL_ASSETS.includes('/ui/hud.js'));
  assert.equal(typeof smoke.fishLevelsLookReady, 'function', 'fishLevelsLookReady must be exported');
  const fishLevelsLookReady = smoke.fishLevelsLookReady;
  assert.equal(fishLevelsLookReady({
    players: [{ fishLevel: 1 }, { fishLevel: 6 }],
    wildlife: [{ fishLevel: 2 }],
  }), true);
  assert.equal(fishLevelsLookReady({ players: [{ fishLevel: 0 }], wildlife: [] }), false);
  assert.equal(fishLevelsLookReady({ players: [{ fishLevel: 7 }], wildlife: [] }), false);
  assert.equal(fishLevelsLookReady({ players: [{ mass: 4 }], wildlife: [] }), false);
});

test('Fish Level client changes advance the offline shell cache', async () => {
  const sw = await readFile('public/sw.js', 'utf8');
  assert.ok(sw.includes("CACHE_NAME = 'abyss-eater-shell-v10'"));
});

test('respawn resets run Fish Level back to one through starter mass', () => {
  const serverLevel = requireFn(gameLogic, 'fishLevelForMass');
  const respawn = requireFn(gameLogic, 'respawnPlayer');
  const player = respawn({ mass: 32, score: 900, deaths: 0 }, { x: 0, y: 0, z: 0 });
  assert.equal(player.mass, 1);
  assert.equal(serverLevel(player.mass), 1);
});
