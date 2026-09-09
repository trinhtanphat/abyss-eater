import test from 'node:test';
import assert from 'node:assert/strict';

const game = await import('../src/game-logic.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof game[name], 'function', `${name} must be implemented`);
  return game[name];
}

test('clampDirection normalizes oversized vectors and rejects non-finite values', () => {
  const clampDirection = requireFn('clampDirection');
  const dir = clampDirection({ x: 3, y: 4, z: 0 });
  assert.ok(Math.abs(Math.hypot(dir.x, dir.y, dir.z) - 1) < 1e-9);
  assert.deepEqual(clampDirection({ x: Infinity, y: 2, z: NaN }), { x: 0, y: 1, z: 0 });
});

test('radius grows with cube root of mass while speed falls as fish grows', () => {
  const radiusForMass = requireFn('radiusForMass');
  const speedForMass = requireFn('speedForMass');
  assert.ok(radiusForMass(8) > radiusForMass(1));
  assert.ok(Math.abs(radiusForMass(8) / radiusForMass(1) - 2) < 1e-9);
  assert.ok(speedForMass(20) < speedForMass(1));
  assert.ok(speedForMass(20) >= 4);
});

test('advancePlayer clamps delta time and keeps movement inside world bounds', () => {
  const advancePlayer = requireFn('advancePlayer');
  const player = { position: { x: 9.9, y: 4.9, z: -9.9 }, mass: 1 };
  const next = advancePlayer(player, { x: 1, y: 1, z: -1 }, 5, { x: 10, y: 5, z: 10 });
  assert.ok(next.position.x <= 10 && next.position.x >= -10);
  assert.ok(next.position.y <= 5 && next.position.y >= -5);
  assert.ok(next.position.z <= 10 && next.position.z >= -10);
  assert.notEqual(next, player);
});

test('canEat requires a meaningful mass advantage and collision proximity', () => {
  const canEat = requireFn('canEat');
  const predator = { mass: 2, position: { x: 0, y: 0, z: 0 } };
  const prey = { mass: 1, position: { x: 1, y: 0, z: 0 } };
  assert.equal(canEat(predator, prey), true);
  assert.equal(canEat({ ...predator, mass: 1.1 }, prey), false);
  assert.equal(canEat(predator, { ...prey, position: { x: 50, y: 0, z: 0 } }), false);
});

test('collectFood grows mass and score only when food is actually reached', () => {
  const collectFood = requireFn('collectFood');
  const player = { mass: 1, score: 0, position: { x: 0, y: 0, z: 0 } };
  const near = collectFood(player, { position: { x: 0.4, y: 0, z: 0 }, value: 0.25 });
  assert.equal(near.eaten, true);
  assert.equal(near.player.mass, 1.25);
  assert.equal(near.player.score, 25);

  const far = collectFood(player, { position: { x: 50, y: 0, z: 0 }, value: 0.25 });
  assert.equal(far.eaten, false);
  assert.equal(far.player.mass, 1);
});

test('respawn resets competitive state and increments deaths', () => {
  const respawnPlayer = requireFn('respawnPlayer');
  const player = { id: 'p1', name: 'Fish', mass: 9, score: 500, deaths: 2, position: { x: 1, y: 1, z: 1 } };
  const next = respawnPlayer(player, { x: -3, y: 2, z: 7 });
  assert.equal(next.mass, 1);
  assert.equal(next.score, 0);
  assert.equal(next.deaths, 3);
  assert.deepEqual(next.position, { x: -3, y: 2, z: 7 });
  assert.equal(next.id, 'p1');
  assert.equal(next.name, 'Fish');
});
