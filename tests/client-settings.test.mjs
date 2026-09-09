import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeSettings, resolveQualityPreset } from '../src/client-settings.mjs';

test('normalizeSettings clamps values and rejects unknown quality', () => {
  assert.deepEqual(normalizeSettings({ quality: 'ultra', master: 4, music: -2, sfx: Number.NaN, tts: 4 }), {
    quality: 'auto',
    reducedEffects: false,
    master: 1,
    music: 0,
    sfx: DEFAULT_SETTINGS.sfx,
    ttsEnabled: false,
    tts: 1,
  });
});

test('normalizeSettings accepts only explicit boolean accessibility and TTS toggles', () => {
  assert.equal(normalizeSettings({ reducedEffects: true }).reducedEffects, true);
  assert.equal(normalizeSettings({ reducedEffects: 'true' }).reducedEffects, false);
  assert.equal(normalizeSettings({ ttsEnabled: true }).ttsEnabled, true);
  assert.equal(normalizeSettings({ ttsEnabled: 'true' }).ttsEnabled, false);
});

test('Vietnamese TTS defaults off with a bounded dedicated volume', () => {
  assert.equal(DEFAULT_SETTINGS.ttsEnabled, false);
  assert.equal(DEFAULT_SETTINGS.tts, 0.8);
  assert.equal(normalizeSettings({ tts: -3 }).tts, 0);
  assert.equal(normalizeSettings({ tts: Number.NaN }).tts, DEFAULT_SETTINGS.tts);
});

test('quality presets are deterministic and auto respects constrained devices', () => {
  assert.deepEqual(resolveQualityPreset({ quality: 'low', reducedEffects: false }, {}), {
    pixelRatioCap: 1,
    bubbles: 90,
    shadows: false,
    decorativeDistance: 45,
  });
  assert.equal(resolveQualityPreset({ quality: 'auto', reducedEffects: true }, { width: 1600, devicePixelRatio: 1 }).pixelRatioCap, 1);
  assert.equal(resolveQualityPreset({ quality: 'auto', reducedEffects: false }, { width: 1400, devicePixelRatio: 2, coarsePointer: false }).pixelRatioCap, 2);
  assert.equal(resolveQualityPreset({ quality: 'auto', reducedEffects: false }, { width: 900, devicePixelRatio: 2.5, coarsePointer: false }).pixelRatioCap, 1.5);
});
