import test from 'node:test';
import assert from 'node:assert/strict';

import { getTheme, themeIds } from '../public/game/themes.js';

const IDS = ['stylized', 'deep-sea', 'twilight-garden', 'blue-trench', 'volcanic-rift', 'leviathan-depths'];

test('theme registry preserves legacy ids and exposes six approved biomes', () => {
  assert.deepEqual(themeIds(), IDS);
  assert.equal(getTheme().id, 'stylized');
  assert.equal(getTheme('deep-sea').id, 'deep-sea');
  for (const id of IDS) {
    const theme = getTheme(id);
    assert.equal(theme.id, id);
    assert.equal(Number.isInteger(theme.decor.accent), true);
    assert.equal(Number.isInteger(theme.decor.accentAlt), true);
  }
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

test('new biomes have distinct bounded presentation targets', () => {
  const backgrounds = IDS.map((id) => getTheme(id).scene.background);
  assert.equal(new Set(backgrounds).size, IDS.length);
  for (const id of IDS) {
    const theme = getTheme(id);
    assert.ok(theme.scene.fogDensity > 0 && theme.scene.fogDensity < 0.05);
    assert.ok(theme.atmosphere.bubbleOpacity >= 0 && theme.atmosphere.bubbleOpacity <= 1);
    assert.ok(theme.fish.roughness >= 0 && theme.fish.roughness <= 1);
  }
});

test('unknown themes still fail safe to stylized', () => {
  assert.equal(getTheme('not-a-theme').id, 'stylized');
});
