import test from 'node:test';
import assert from 'node:assert/strict';
import * as world from '../src/world.mjs';

const bounds = { x: 80, y: 28, z: 80 };

test('biome membership is derived only from bounded server depth', () => {
  assert.equal(world.biomeForPosition({ y: 28 }, bounds), 'surface');
  assert.equal(world.biomeForPosition({ y: 10 }, bounds), 'reef');
  assert.equal(world.biomeForPosition({ y: -5 }, bounds), 'deep');
  assert.equal(world.biomeForPosition({ y: -24 }, bounds), 'abyss');
  assert.equal(world.biomeForPosition({ y: Number.NaN }, bounds), 'reef');
});

test('biome profiles expose bounded density and risk metadata', () => {
  assert.deepEqual(world.BIOME_IDS, ['surface', 'reef', 'deep', 'abyss']);
  assert.ok(world.biomeProfile('abyss').risk > world.biomeProfile('surface').risk);
  assert.ok(world.biomeProfile('deep').pickupWeight >= world.biomeProfile('reef').pickupWeight);
});

test('biome spawn points stay inside their authoritative depth band', () => {
  const point = world.spawnPointInBiome('abyss', bounds, () => 0.5);
  assert.equal(world.biomeForPosition(point, bounds), 'abyss');
  assert.ok(Math.abs(point.x) <= bounds.x && Math.abs(point.z) <= bounds.z);
});