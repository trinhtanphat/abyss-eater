import test from 'node:test';
import assert from 'node:assert/strict';

import { getTheme, themeIds } from '../public/game/themes.js';

const EXPECTED_THEME_IDS = [
  'stylized',
  'deep-sea',
  'twilight-garden',
  'blue-trench',
  'volcanic-rift',
  'leviathan-depths',
];

test('theme registry keeps stylized first and deep-sea compatible inside the biome catalog', () => {
  assert.deepEqual(themeIds(), EXPECTED_THEME_IDS);
  assert.deepEqual(themeIds().slice(0, 2), ['stylized', 'deep-sea']);
  assert.equal(getTheme().id, 'stylized');
  assert.equal(getTheme('deep-sea').id, 'deep-sea');
});

test('deep sea is darker, foggier and materially rougher than stylized mode', () => {
  const stylized = getTheme('stylized');
  const deepSea = getTheme('deep-sea');
  assert.notEqual(deepSea.scene.background, stylized.scene.background);
  assert.ok(deepSea.scene.fogDensity > stylized.scene.fogDensity);
  assert.ok(deepSea.fish.roughness > stylized.fish.roughness);
  assert.ok(deepSea.fish.emissiveBoost < stylized.fish.emissiveBoost);
  assert.ok(deepSea.atmosphere.shaftOpacity < stylized.atmosphere.shaftOpacity);
  assert.ok(deepSea.atmosphere.planktonSize < stylized.atmosphere.planktonSize);
});

test('unknown themes still fail safe to stylized', () => {
  assert.equal(getTheme('not-a-theme').id, 'stylized');
});
