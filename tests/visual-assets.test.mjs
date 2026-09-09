import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  EVOLUTION_TIERS,
  evolutionTierForMass,
  silhouetteForMass,
} from '../public/game/fish-evolution.mjs';

test('fish evolution tiers preserve the existing log2 mass progression', () => {
  assert.deepEqual(
    [1, 2, 4, 8, 16, 32].map((mass) => evolutionTierForMass(mass)),
    ['fry', 'reefling', 'hunter', 'razorfin', 'abyss-predator', 'leviathan'],
  );

  assert.equal(evolutionTierForMass(1.99), 'fry');
  assert.equal(evolutionTierForMass(31.99), 'abyss-predator');
  assert.equal(evolutionTierForMass(10_000), 'leviathan');
});

test('invalid fish mass normalizes to the fry visual tier', () => {
  for (const mass of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(evolutionTierForMass(mass), 'fry');
  }
});

test('the evolution catalog exposes six unique readable silhouettes', () => {
  assert.equal(EVOLUTION_TIERS.length, 6);
  assert.equal(new Set(EVOLUTION_TIERS.map((tier) => tier.id)).size, 6);

  const profiles = [1, 2, 4, 8, 16, 32].map((mass) => silhouetteForMass(mass));
  assert.equal(new Set(profiles.map((profile) => profile.id)).size, 6);
  assert.ok(profiles[5].body[0] > profiles[0].body[0], 'leviathan body must be longer than fry body');
  assert.ok(profiles[5].mouthScale > profiles[0].mouthScale, 'leviathan jaw cue must be stronger than fry');
  assert.ok(profiles[5].spineCount > profiles[0].spineCount, 'leviathan must expose more silhouette spines than fry');
});

test('fish renderer applies evolution silhouettes and localized bioluminescence', async () => {
  const fish = await readFile('public/game/fish.js', 'utf8');

  assert.ok(fish.includes("import { silhouetteForMass } from './fish-evolution.mjs';"), 'fish renderer must consume the deterministic visual profile');
  assert.ok(fish.includes('function applyEvolutionSilhouette'), 'fish renderer must have a bounded tier application path');
  assert.ok(fish.includes('data.appliedEvolutionTier'), 'fish rig must cache the applied visual tier');
  assert.ok(fish.includes('gillAccents'), 'local recognition must include gill accents');
  assert.ok(fish.includes('lateralLines'), 'local recognition must include lateral-line accents');
  assert.ok(fish.includes('biolumeMaterial'), 'localized accents must use a dedicated material');
  assert.ok(fish.includes('data.biolumeMaterial?.dispose?.();'), 'per-rig bioluminescence material must be disposed');
});
