import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWildlifePopulation, stepWildlife, wildlifeBehaviorFor, WILDLIFE_UPDATE_BUDGET } from '../src/wildlife.mjs';

const bounds = { x: 80, y: 28, z: 80 };

test('wildlife catalog includes schooling, flee, hunt and apex behavior classes', () => {
  const population = makeWildlifePopulation(() => ({ x: 0, y: 0, z: 0 }), (() => { let i = 0; return () => `w${++i}`; })());
  const behaviors = new Set(population.map(wildlifeBehaviorFor));
  assert.deepEqual([...behaviors].sort(), ['apex', 'flee', 'hunt', 'school']);
});

test('one AI step mutates no more than the fixed actor work budget', () => {
  const population = makeWildlifePopulation(() => ({ x: 0, y: 0, z: 0 }), (() => { let i = 0; return () => `w${++i}`; })());
  const next = stepWildlife(population, [{ id: 'p', mass: 1, position: { x: 2, y: 0, z: 0 } }], 0.25, bounds, 1000);
  const moved = next.filter((actor, index) => JSON.stringify(actor.position) !== JSON.stringify(population[index].position));
  assert.ok(moved.length > 0 && moved.length <= WILDLIFE_UPDATE_BUDGET);
});

test('apex actors transition from wander to stalk/chase using server proximity', () => {
  const actor = { id: 'boss', mass: 6.2, behavior: 'apex', aiState: 'wander', position: { x: 0, y: -24, z: 0 }, heading: { x: 1, y: 0, z: 0 }, seed: 7 };
  const next = stepWildlife([actor], [{ id: 'p', mass: 1, position: { x: 5, y: -24, z: 0 } }], 0.25, bounds, 1000)[0];
  assert.ok(['stalk', 'chase'].includes(next.aiState));
});