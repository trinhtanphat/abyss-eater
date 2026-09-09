import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKIN_CATALOG } from '../src/progression.mjs';

const clientSkins = await import('../public/game/skins.js').catch(() => ({}));

test('client cosmetic palette mirrors the canonical server catalog exactly', () => {
  assert.equal(typeof clientSkins.skinVisual, 'function', 'skinVisual must be implemented');
  for (const skin of SKIN_CATALOG) {
    assert.deepEqual(clientSkins.skinVisual(skin.id), {
      id: skin.id,
      bodyColor: skin.bodyColor,
      accentColor: skin.accentColor,
      emissive: skin.emissive,
    });
  }
  assert.equal(clientSkins.skinVisual('missing'), null);
});

test('Worker exposes only a server-verified selected skin id in multiplayer snapshots', () => {
  const worker = readFileSync('src/worker.template.mjs', 'utf8');
  for (const marker of [
    'skinId: player.skinId',
    "url.searchParams.delete('skin')",
    "skinById(profile.selectedSkinId)",
    "url.searchParams.set('skin', profile.selectedSkinId)",
    "const requestedSkinId = skinById(url.searchParams.get('skin'))?.id || ''",
    'skinId: requestedSkinId',
  ]) {
    assert.ok(worker.includes(marker), `verified cosmetic flow must include ${marker}`);
  }
  const network = readFileSync('public/game/network.js', 'utf8');
  assert.equal(network.includes("searchParams.set('skin'"), false, 'browser must never choose authoritative multiplayer skin');
  assert.equal(network.includes("searchParams.set('profile'"), false, 'browser must never choose authoritative profile');
});

test('fish renderer applies snapshot skin ids without changing authoritative gameplay fields', () => {
  const fish = readFileSync('public/game/fish.js', 'utf8');
  for (const marker of [
    "from './skins.js'",
    'function applyFishAppearance',
    'skinVisual(data.skinId)',
    'data.skinId = typeof player.skinId',
  ]) {
    assert.ok(fish.includes(marker), `fish cosmetic renderer must include ${marker}`);
  }
  assert.equal(fish.includes('player.speed'), false);
  assert.equal(fish.includes('player.radius'), false);
});
