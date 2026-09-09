import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const game = await import('../src/game-logic.mjs').catch(() => ({}));
const wildlife = await import('../src/wildlife.mjs').catch(() => ({}));
const presentation = await import('../public/game/presentation.js').catch(() => ({}));

function requireFn(source, name) {
  assert.equal(typeof source[name], 'function', `${name} must be implemented`);
  return source[name];
}

test('starter fish can eat a visibly smaller wildlife fish', () => {
  const canEat = requireFn(game, 'canEat');
  assert.equal(canEat(
    { id: 'me', mass: 1, position: { x: 0, y: 0, z: 0 } },
    { id: 'prey', mass: 0.6, position: { x: 0.5, y: 0, z: 0 } },
  ), true);
  assert.equal(canEat(
    { id: 'me', mass: 1, position: { x: 0, y: 0, z: 0 } },
    { id: 'invalid', mass: 0.05, position: { x: 0.1, y: 0, z: 0 } },
  ), false);
});

test('wildlife population always contains prey and predators around starter mass', () => {
  const makeWildlifePopulation = requireFn(wildlife, 'makeWildlifePopulation');
  assert.ok(Number.isInteger(wildlife.WILDLIFE_COUNT) && wildlife.WILDLIFE_COUNT >= 16);
  let id = 0;
  const population = makeWildlifePopulation(
    () => ({ x: 0, y: 0, z: 0 }),
    () => `wild-${++id}`,
  );
  assert.equal(population.length, wildlife.WILDLIFE_COUNT);
  assert.ok(population.some((fish) => fish.mass <= 0.7), 'must include edible starter prey');
  assert.ok(population.some((fish) => fish.mass >= 1.8), 'must include obvious starter predators');
  assert.ok(population.every((fish) => fish.kind === 'wildlife' && fish.id.startsWith('wild-')));
});

test('wildlife step is bounded and gives predators/fleeing prey meaningful motion', () => {
  const stepWildlife = requireFn(wildlife, 'stepWildlife');
  const population = [
    { id: 'prey', kind: 'wildlife', mass: 0.6, position: { x: 0, y: 0, z: 0 }, heading: { x: 1, y: 0, z: 0 }, seed: 1 },
    { id: 'hunter', kind: 'wildlife', mass: 2.4, position: { x: 4, y: 0, z: 0 }, heading: { x: -1, y: 0, z: 0 }, seed: 2 },
  ];
  const players = [{ id: 'me', mass: 1, position: { x: 1, y: 0, z: 0 } }];
  const next = stepWildlife(population, players, 0.25, { x: 5, y: 3, z: 5 }, 1000);
  assert.equal(next.length, 2);
  assert.ok(next.every((fish) => Math.abs(fish.position.x) <= 5 && Math.abs(fish.position.y) <= 3 && Math.abs(fish.position.z) <= 5));
  assert.notDeepEqual(next.map((fish) => fish.position), population.map((fish) => fish.position));
});

test('client keeps wildlife across delta snapshots and renders masses below one', async () => {
  const stateSource = await readFile('public/game/state.js', 'utf8');
  const fishSource = await readFile('public/game/fish.js', 'utf8');
  const appSource = await readFile('public/app.js', 'utf8');
  assert.ok(stateSource.includes('Array.isArray(next.wildlife) ? next.wildlife : snapshot.wildlife'));
  assert.ok(fishSource.includes('Math.max(0.2, Number(player.mass) || 1)'));
  assert.ok(appSource.includes('wildlifeMeshes'));
  assert.ok(appSource.includes('state.snapshot.wildlife'));
});

test('ecosystem summary counts edible prey and dangerous fish relative to local mass', () => {
  const ecosystemSummary = requireFn(presentation, 'ecosystemSummary');
  const summary = ecosystemSummary([
    { id: 'me', mass: 1 },
    { id: 'prey', mass: 0.6 },
    { id: 'too-close', mass: 0.95 },
    { id: 'threat', mass: 2 },
  ], 'me');
  assert.deepEqual(summary, { prey: 1, threats: 1 });
});

test('worker build embeds bounded wildlife simulation', async () => {
  const buildSource = await readFile('scripts/build.mjs', 'utf8');
  const templateSource = await readFile('src/worker.template.mjs', 'utf8');
  assert.ok(buildSource.includes("readFile('src/wildlife.mjs'"));
  assert.ok(templateSource.includes('/*__WILDLIFE__*/'));
  assert.ok(templateSource.includes('this.wildlife'));
  assert.ok(templateSource.includes('wildlifeDirty'));
  assert.ok(templateSource.includes('stepWildlife('));
});
