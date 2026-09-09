import test from 'node:test';
import assert from 'node:assert/strict';
import * as actors from '../src/world-actors.mjs';
import { movementMultiplierForPlayer } from '../src/game-logic.mjs';
import { rewardForSession } from '../src/progression.mjs';

const player = { id: 'p', mass: 1, score: 0, bonusPearls: 0, position: { x: 0, y: -20, z: 0 } };

test('jelly hazard applies a bounded timestamp slow without client authority', () => {
  const hit = actors.resolveHazardContact(player, { id: 'h', type: 'jelly', radius: 1.4, position: { x: 0, y: -20, z: 0 } }, 1000);
  assert.equal(hit.hit, true);
  assert.equal(hit.player.slowUntil, 3000);
  assert.equal(movementMultiplierForPlayer(hit.player, 1500), 0.65);
  assert.equal(movementMultiplierForPlayer(hit.player, 3001), 1);
});

test('current pickup gives bounded temporary speed and is consumed once', () => {
  const hit = actors.resolvePickupContact(player, { id: 'u', type: 'current', radius: 1.2, position: { x: 0, y: -20, z: 0 } }, 1000);
  assert.equal(hit.consumed, true);
  assert.equal(hit.player.speedBoostUntil, 5000);
  assert.equal(movementMultiplierForPlayer(hit.player, 1500), 1.2);
});

test('pearl pickup contributes only a server-derived bounded reward bonus', () => {
  const hit = actors.resolvePickupContact(player, { id: 'u', type: 'pearl', value: 3, radius: 1.2, position: { x: 0, y: -20, z: 0 } }, 1000);
  assert.equal(hit.player.bonusPearls, 3);
  assert.equal(rewardForSession({ score: 0, mass: 1, bonusPearls: hit.player.bonusPearls }).pearls, 3);
});