import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeSettings, resolveQualityPreset } from '../public/client-settings.mjs';

test('settings normalize unknown quality and clamp local presentation volumes', () => {
  assert.deepEqual(normalizeSettings({ quality: 'ultra', master: 4, music: -2, sfx: Number.NaN }), {
    quality: 'auto',
    reducedEffects: false,
    master: 1,
    music: 0,
    sfx: DEFAULT_SETTINGS.sfx,
  });
});

test('quality auto respects constrained devices and reduced effects', () => {
  assert.equal(resolveQualityPreset({ quality: 'auto', reducedEffects: true }, { width: 1600, devicePixelRatio: 1 }).pixelRatioCap, 1);
  assert.equal(resolveQualityPreset({ quality: 'auto', reducedEffects: false }, { width: 1400, devicePixelRatio: 2, coarsePointer: false }).pixelRatioCap, 2);
  assert.equal(resolveQualityPreset({ quality: 'auto', reducedEffects: false }, { width: 900, devicePixelRatio: 2.5, coarsePointer: false }).pixelRatioCap, 1.5);
});
