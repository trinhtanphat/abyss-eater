import test from 'node:test';
import assert from 'node:assert/strict';
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
