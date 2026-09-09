import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  EVOLUTION_TIERS,
  evolutionTierForMass,
  silhouetteForMass,
} from '../public/game/fish-evolution.mjs';
import {
  SKIN_FAMILIES,
  skinFamilyForId,
  skinPaletteFor,
} from '../public/game/fish-skins.mjs';
import { getTheme } from '../public/game/themes.js';

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

test('fish renderer applies evolution silhouettes and localized bioluminescence without flattening sub-one wildlife mass', async () => {
  const fish = await readFile('public/game/fish.js', 'utf8');

  assert.ok(fish.includes("import { silhouetteForMass } from './fish-evolution.mjs';"), 'fish renderer must consume the deterministic visual profile');
  assert.ok(fish.includes('function applyEvolutionSilhouette'), 'fish renderer must have a bounded tier application path');
  assert.ok(fish.includes('data.appliedEvolutionTier'), 'fish rig must cache the applied visual tier');
  assert.ok(fish.includes('gillAccents'), 'local recognition must include gill accents');
  assert.ok(fish.includes('lateralLines'), 'local recognition must include lateral-line accents');
  assert.ok(fish.includes('biolumeMaterial'), 'localized accents must use a dedicated material');
  assert.ok(fish.includes('data.biolumeMaterial?.dispose?.();'), 'per-rig bioluminescence material must be disposed');
  assert.ok(fish.includes('data.mass = Math.max(0.2,'), 'wildlife below starter mass must preserve its true rendered size');
  assert.ok(fish.includes('Math.cbrt(Math.max(0.2, data.mass))'), 'render scale must preserve the sub-one predator-loop hierarchy');
});

test('food renderer uses a grouped marine silhouette instead of a standalone polyhedron', async () => {
  const fish = await readFile('public/game/fish.js', 'utf8');
  const start = fish.indexOf('export function createFoodMesh');
  const end = fish.indexOf('export function applyFoodTheme');
  const foodRenderer = fish.slice(start, end);

  assert.ok(foodRenderer.includes('const group = new THREE.Group();'), 'food must be composed from multiple marine-form parts');
  assert.ok(foodRenderer.includes('FOOD_FIN_GEOMETRY'), 'food must include a readable fin/tendril silhouette');
  assert.ok(foodRenderer.includes('group.userData.foodMaterial = material;'), 'food group must preserve the existing theme/lifecycle material hook');
  assert.ok(!foodRenderer.includes('new THREE.Mesh(FOOD_GEOMETRY, material)'), 'food must not remain a standalone icosahedron');
});

test('effect manager owns bounded disposable eat and growth pulse rings', async () => {
  const effects = await readFile('public/game/effects.js', 'utf8');

  assert.ok(effects.includes('const RING_GEOMETRY'), 'pulse rings must reuse one shared geometry');
  assert.ok(effects.includes('const rings = []'), 'effect manager must track transient rings');
  assert.ok(effects.includes('function pulseRing'), 'effect manager must have a bounded ring creation path');
  assert.ok(effects.includes('function removeRing'), 'effect manager must have a ring cleanup path');
  assert.ok(effects.includes('ring.mesh.material.dispose();'), 'each transient ring material must be disposed');
  assert.ok(effects.includes('pulseRing(position, color, 1.75'), 'eat must trigger the stronger pulse ring');
  assert.ok(effects.includes('pulseRing(position, 0xb9ffe9, 1.1'), 'growth must trigger the softer pulse ring');
  assert.ok(effects.includes('for (const ring of [...rings])'), 'rings must update and clean up during the normal effect loop');
  assert.ok(effects.includes('if (reducedMotion) return;'), 'pulse rings must respect reduced-effects mode');
});

test('the approved skin catalog exposes twelve deterministic families', () => {
  assert.equal(SKIN_FAMILIES.length, 12);
  assert.equal(new Set(SKIN_FAMILIES.map((skin) => skin.id)).size, 12);
  assert.equal(skinFamilyForId('player-42').id, skinFamilyForId('player-42').id);
  assert.ok(skinFamilyForId('player-42').id);
});

test('skin palettes remain numeric and bounded across ocean themes', () => {
  for (const themeId of ['stylized', 'deep-sea', 'twilight-garden', 'blue-trench', 'volcanic-rift', 'leviathan-depths']) {
    const palette = skinPaletteFor('player-42', getTheme(themeId));
    for (const key of ['body', 'fin', 'accent', 'emissive']) assert.equal(Number.isInteger(palette[key]), true, `${key} must be a numeric hex color`);
    assert.ok(palette.roughnessOffset >= -0.25 && palette.roughnessOffset <= 0.25);
    assert.ok(palette.metalnessOffset >= -0.1 && palette.metalnessOffset <= 0.18);
  }
});

test('fish renderer preserves verified cosmetics and uses deterministic palettes only as fallback', async () => {
  const fish = await readFile('public/game/fish.js', 'utf8');
  assert.ok(fish.includes("import { skinVisual } from './skins.js';"), 'server-verified cosmetic palette must remain authoritative');
  assert.ok(fish.includes("import { skinPaletteFor } from './fish-skins.mjs';"), 'deterministic family fallback must remain available');
  assert.ok(fish.includes('skinVisual(data.skinId)'), 'snapshot skin id must be resolved first');
  assert.ok(fish.includes('const fallback = skinPaletteFor(data.id, theme);'), 'fallback palette must be derived from fish id only after verified skin lookup');
  assert.ok(fish.includes('data.skinFamilyId = fallback.id;'));
  assert.ok(fish.includes('theme.fish.local'), 'local recognition must remain theme-driven bioluminescence');
});

test('offline shell precaches fish evolution, TTS, progression and skin dependencies', async () => {
  const sw = await readFile('public/sw.js', 'utf8');
  assert.ok(sw.includes("'/client-tts.mjs'"), 'reconciled shell must preserve the Vietnamese TTS dependency');
  assert.ok(sw.includes("'/client-progression.mjs'"), 'reconciled shell must cache the progression client');
  assert.ok(sw.includes("'/game/fish-evolution.mjs'"), 'service worker shell must cache fish evolution');
  assert.ok(sw.includes("'/game/skins.js'"), 'service worker shell must preserve verified cosmetic visuals');
  assert.ok(sw.includes("'/game/fish-skins.mjs'"), 'service worker shell must cache deterministic fallback palettes');
  assert.ok(sw.includes("'/game/biomes.js'"), 'service worker shell must cache biome presentation');
  assert.ok(sw.includes("'/game/world-actors.js'"), 'service worker shell must cache world actor presentation');
  assert.ok(sw.includes("CACHE_NAME = 'abyss-eater-shell-v8'"), 'shell version must match the reconciled visual dependency set');
});
