import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('src/worker.template.mjs', 'utf8');

test('GameRoom owns biome, hazards and pickups without a perpetual timer', () => {
  for (const marker of [
    'this.worldActors = makeWorldActors(',
    'biome: player.biome',
    'hazards: this.worldActors.hazards',
    'pickups: this.worldActors.pickups',
    'resolveHazardContact(',
    'resolvePickupContact(',
    'biomeForPosition(player.position, WORLD_BOUNDS)',
  ]) assert.ok(worker.includes(marker), `missing world integration: ${marker}`);
  assert.equal(worker.includes('setInterval('), false);
});