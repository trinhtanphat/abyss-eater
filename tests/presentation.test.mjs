import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dangerLevel,
  growthProgress,
  leaderboard,
  normalizePlanarInput,
  normalizeQuality,
  normalizeTheme,
} from '../public/game/presentation.js';

test('theme normalization keeps supported modes and defaults to stylized', () => {
  assert.equal(normalizeTheme('stylized'), 'stylized');
  assert.equal(normalizeTheme('deep-sea'), 'deep-sea');
  assert.equal(normalizeTheme('DEEP-SEA'), 'deep-sea');
  assert.equal(normalizeTheme('unknown'), 'stylized');
  assert.equal(normalizeTheme(null), 'stylized');
});

test('quality normalization keeps canonical values and defaults to auto', () => {
  for (const value of ['auto', 'high', 'medium', 'low']) assert.equal(normalizeQuality(value), value);
  assert.equal(normalizeQuality('HIGH'), 'high');
  assert.equal(normalizeQuality('balanced'), 'auto');
  assert.equal(normalizeQuality('ultra'), 'auto');
});

test('growth progress is finite and clamped between zero and one', () => {
  assert.equal(growthProgress(0), 0);
  assert.equal(growthProgress(1), 0);
  assert.ok(growthProgress(4) > 0 && growthProgress(4) < 1);
  assert.equal(growthProgress(64), 1);
  assert.equal(growthProgress(Number.POSITIVE_INFINITY), 0);
});

test('leaderboard sorts by score then mass and marks the local player', () => {
  const rows = leaderboard([
    { id: 'a', name: 'A', score: 4, mass: 5 },
    { id: 'me', name: 'Me', score: 9, mass: 2 },
    { id: 'b', name: 'B', score: 9, mass: 7 },
    { id: 'c', score: 1, mass: 1 },
  ], 'me', 3);
  assert.deepEqual(rows.map((row) => row.id), ['b', 'me', 'a']);
  assert.equal(rows[1].isLocal, true);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows.length, 3);
});

test('danger detection chooses the nearest materially larger nearby fish', () => {
  const players = [
    { id: 'me', mass: 4, position: { x: 0, y: 0, z: 0 } },
    { id: 'safe', mass: 4.6, position: { x: 2, y: 0, z: 0 } },
    { id: 'far', mass: 20, position: { x: 100, y: 0, z: 0 } },
    { id: 'threat', name: 'Sharky', mass: 10, position: { x: 6, y: 0, z: 0 } },
  ];
  const result = dangerLevel(players, 'me', 20);
  assert.equal(result.level, 'danger');
  assert.equal(result.threat.id, 'threat');
  assert.equal(result.threat.name, 'Sharky');
});

test('danger detection returns safe when there is no eligible threat', () => {
  const result = dangerLevel([
    { id: 'me', mass: 8, position: { x: 0, y: 0, z: 0 } },
    { id: 'small', mass: 5, position: { x: 1, y: 0, z: 0 } },
  ], 'me', 20);
  assert.deepEqual(result, { level: 'safe', threat: null });
});

test('planar input normalization preserves direction and caps magnitude', () => {
  assert.deepEqual(normalizePlanarInput({ x: 0, z: 0 }), { x: 0, z: 0 });
  assert.deepEqual(normalizePlanarInput({ x: 0.5, z: -0.25 }), { x: 0.5, z: -0.25 });
  const normalized = normalizePlanarInput({ x: 3, z: 4 });
  assert.ok(Math.abs(normalized.x - 0.6) < 1e-9);
  assert.ok(Math.abs(normalized.z - 0.8) < 1e-9);
});
