import test from 'node:test';
import assert from 'node:assert/strict';

const spatial = await import('../src/spatial-grid.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof spatial[name], 'function', `${name} must be implemented`);
  return spatial[name];
}

test('cellKey floors positive and negative coordinates consistently', () => {
  const cellKey = requireFn('cellKey');
  assert.equal(cellKey({ x: 0, y: 0, z: 0 }, 8), '0,0,0');
  assert.equal(cellKey({ x: 7.999, y: 8, z: -0.001 }, 8), '0,1,-1');
  assert.equal(cellKey({ x: -8, y: -8.001, z: 15.9 }, 8), '-1,-2,1');
  assert.throws(() => cellKey({ x: 0, y: 0, z: 0 }, 0), RangeError);
});

test('buildSpatialBuckets groups items by position without mutating them', () => {
  const buildSpatialBuckets = requireFn('buildSpatialBuckets');
  const items = [
    { id: 'a', position: { x: 1, y: 1, z: 1 } },
    { id: 'b', position: { x: 7, y: 1, z: 1 } },
    { id: 'c', position: { x: 9, y: 1, z: 1 } },
  ];
  const buckets = buildSpatialBuckets(items, 8, (item) => item.position);
  assert.deepEqual(buckets.get('0,0,0').map((item) => item.id), ['a', 'b']);
  assert.deepEqual(buckets.get('1,0,0').map((item) => item.id), ['c']);
  assert.deepEqual(items.map((item) => item.id), ['a', 'b', 'c']);
});

test('nearbyFromBuckets returns the 27 neighboring cells once each', () => {
  const buildSpatialBuckets = requireFn('buildSpatialBuckets');
  const nearbyFromBuckets = requireFn('nearbyFromBuckets');
  const items = [
    { id: 'center', position: { x: 1, y: 1, z: 1 } },
    { id: 'left', position: { x: -1, y: 1, z: 1 } },
    { id: 'diag', position: { x: 9, y: 9, z: 9 } },
    { id: 'far', position: { x: 25, y: 1, z: 1 } },
  ];
  const buckets = buildSpatialBuckets(items, 8, (item) => item.position);
  const nearby = nearbyFromBuckets(buckets, { x: 1, y: 1, z: 1 }, 8);
  assert.deepEqual(nearby.map((item) => item.id).sort(), ['center', 'diag', 'left']);
  assert.equal(new Set(nearby).size, nearby.length);
});