import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getTheme, themeIds } from '../public/game/themes.js';

const EXPECTED_BIOMES = [
  'stylized',
  'deep-sea',
  'twilight-garden',
  'blue-trench',
  'volcanic-rift',
  'leviathan-depths',
];

test('theme registry exposes the six approved ocean biome presentations', () => {
  assert.deepEqual(themeIds(), EXPECTED_BIOMES);
  for (const id of EXPECTED_BIOMES) {
    const theme = getTheme(id);
    assert.equal(theme.id, id);
    assert.equal(typeof theme.decor.accent, 'number');
    assert.equal(typeof theme.decor.accentAlt, 'number');
    assert.equal(typeof theme.css.accent, 'string');
  }
});

test('legacy ocean style ids stay compatible with saved settings', () => {
  assert.equal(getTheme('stylized').id, 'stylized');
  assert.equal(getTheme('deep-sea').id, 'deep-sea');
  assert.equal(getTheme('unknown-style').id, 'stylized');
});

test('environment uses instanced shared biome accent props', async () => {
  const source = await readFile('public/game/environment.js', 'utf8');
  assert.ok(source.includes('accentMaterial'), 'environment must own a reusable accent material');
  assert.ok(source.includes('accentAltMaterial'), 'environment must own a second reusable accent material');
  assert.ok(source.includes('accentDecor'), 'environment must create an instanced accent prop family');
  assert.ok(source.includes('accentAltDecor'), 'environment must create a second instanced accent prop family');
  assert.ok(source.includes('createInstancedDecor'), 'accent props must reuse the existing instancing path');
});

test('both ocean style selectors expose all six biome ids', async () => {
  const html = await readFile('public/index.html', 'utf8');
  for (const id of EXPECTED_BIOMES) {
    const matches = html.match(new RegExp(`value=\\"${id}\\"`, 'g')) || [];
    assert.equal(matches.length, 2, `${id} must appear in lobby and live settings selectors`);
  }
});
