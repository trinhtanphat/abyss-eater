import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { getTheme, themeIds } from '../public/game/themes.js';

const EXPECTED_THEMES = [
  'stylized',
  'deep-sea',
  'twilight-garden',
  'blue-trench',
  'volcanic-rift',
  'leviathan-depths',
];

const HUD_ASSETS = [
  'public/assets/brand/abyss-eater-mark.svg',
  'public/assets/ui/icons/mass.svg',
  'public/assets/ui/icons/crown.svg',
  'public/assets/ui/icons/skull.svg',
  'public/assets/ui/icons/jaw.svg',
  'public/assets/ui/icons/evolution.svg',
  'public/assets/ui/icons/depth.svg',
  'public/assets/ui/icons/settings.svg',
];

test('six-biome catalog preserves legacy ids and exposes reusable accent colors', () => {
  assert.deepEqual(themeIds(), EXPECTED_THEMES);
  assert.equal(getTheme('stylized').id, 'stylized');
  assert.equal(getTheme('deep-sea').id, 'deep-sea');
  for (const id of EXPECTED_THEMES) {
    const theme = getTheme(id);
    for (const section of ['scene', 'lighting', 'floor', 'water', 'decor', 'food', 'fish', 'atmosphere', 'css']) {
      assert.ok(theme[section], `${id} must expose ${section}`);
    }
    assert.equal(Number.isInteger(theme.decor.accent), true, `${id} decor.accent must be numeric hex`);
    assert.equal(Number.isInteger(theme.decor.accentAlt), true, `${id} decor.accentAlt must be numeric hex`);
  }
});

test('ocean selectors expose all approved biomes without legacy id changes', () => {
  const html = readFileSync('public/index.html', 'utf8');
  for (const id of EXPECTED_THEMES) {
    const occurrences = html.split(`value="${id}"`).length - 1;
    assert.ok(occurrences >= 2, `${id} must appear in both Ocean style selectors`);
  }
  assert.equal(html.includes('value="winter"'), false, 'unapproved winter biome must not exist');
});

test('environment uses two secondary instanced biome prop families', () => {
  const source = readFileSync('public/game/environment.js', 'utf8');
  for (const marker of ['accentGeometry', 'accentAltGeometry', 'accentMaterial', 'accentAltMaterial']) {
    assert.ok(source.includes(marker), `environment must include ${marker}`);
  }
  const calls = source.match(/createInstancedDecor\(/g) || [];
  assert.ok(calls.length >= 7, 'environment should instance existing decor plus two accent prop families');
  assert.ok(source.includes('nextTheme.decor.accent'));
  assert.ok(source.includes('nextTheme.decor.accentAlt'));
});

test('deterministic fish skin catalog exposes twelve stable palette families', async () => {
  const skins = await import('../public/game/fish-skins.mjs').catch(() => ({}));
  assert.ok(Array.isArray(skins.SKIN_FAMILIES), 'SKIN_FAMILIES must exist');
  assert.equal(skins.SKIN_FAMILIES.length, 12);
  assert.equal(new Set(skins.SKIN_FAMILIES.map((skin) => skin.id)).size, 12);
  assert.equal(typeof skins.skinFamilyForId, 'function');
  assert.equal(typeof skins.skinPaletteFor, 'function');
  assert.equal(skins.skinFamilyForId('player-42').id, skins.skinFamilyForId('player-42').id);
  const palette = skins.skinPaletteFor('player-42', getTheme('stylized'));
  for (const key of ['body', 'fin', 'accent', 'emissive']) assert.equal(Number.isInteger(palette[key]), true, `${key} must be numeric hex`);
  assert.ok(Number.isFinite(palette.roughnessOffset));
  assert.ok(Number.isFinite(palette.metalnessOffset));
});

test('fish renderer consumes deterministic skins without weakening local cyan recognition', () => {
  const fish = readFileSync('public/game/fish.js', 'utf8');
  assert.ok(fish.includes("import { skinFamilyForId, skinPaletteFor } from './fish-skins.mjs';"));
  assert.ok(fish.includes('skinPaletteFor(id, theme)'));
  assert.ok(fish.includes('skinFamilyId'));
  assert.ok(fish.includes('biolumeMaterial'), 'local cyan bioluminescence must remain the strongest recognition cue');
  assert.ok(fish.includes('data.mass = Math.max(0.2,'), 'sub-one wildlife sizing must remain intact');
});

test('brand and HUD SVG pack is same-origin, dependency-free and wired into the shell', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const css = readFileSync('public/styles.css', 'utf8');
  for (const path of HUD_ASSETS) {
    assert.equal(existsSync(path), true, `${path} must exist`);
    const svg = readFileSync(path, 'utf8');
    assert.ok(svg.includes('<svg'));
    assert.equal(/<script|https?:\/\/|data:image\//i.test(svg), false, `${path} must be self-contained`);
  }
  assert.ok(html.includes('/assets/brand/abyss-eater-mark.svg'));
  for (const icon of ['mass', 'crown', 'skull', 'jaw', 'evolution', 'depth', 'settings']) {
    assert.ok(html.includes(`/assets/ui/icons/${icon}.svg`), `${icon} icon must be referenced by markup`);
  }
  assert.ok(css.includes('.metric-icon'));
  assert.ok(css.includes('.hud-brand-mark'));
  for (const stableId of ['hud-mass', 'hud-score', 'hud-rank', 'hud-players', 'hud-ping', 'growth-progress', 'depth-meter', 'settings-button']) {
    assert.ok(html.includes(`id="${stableId}"`), `${stableId} must remain stable`);
  }
});

test('offline shell v8 closes over progression, TTS, evolution, skins and new SVGs', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  assert.ok(sw.includes("CACHE_NAME = 'abyss-eater-shell-v8'"));
  for (const dependency of [
    '/client-progression.mjs',
    '/client-tts.mjs',
    '/game/fish-evolution.mjs',
    '/game/fish-skins.mjs',
    ...HUD_ASSETS.map((path) => `/${path.replace(/^public\//, '')}`),
  ]) {
    assert.ok(sw.includes(`'${dependency}'`), `offline shell must include ${dependency}`);
  }
});
