import test from 'node:test';
import assert from 'node:assert/strict';

const progression = await import('../src/progression.mjs').catch(() => ({}));

function requireExport(name) {
  assert.notEqual(progression[name], undefined, `${name} must be implemented`);
  return progression[name];
}

test('levelForXp uses deterministic cumulative thresholds', () => {
  const levelForXp = requireExport('levelForXp');
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(299), 2);
  assert.equal(levelForXp(300), 3);
  assert.equal(levelForXp(Number.NaN), 1);
});

test('rewardForSession is server-derived and bounded', () => {
  const rewardForSession = requireExport('rewardForSession');
  assert.deepEqual(rewardForSession({ score: 0, mass: 1 }), { xp: 0, pearls: 0 });
  const normal = rewardForSession({ score: 25, mass: 4 });
  assert.ok(normal.xp > 0 && normal.xp <= 5000);
  assert.ok(normal.pearls > 0 && normal.pearls <= 500);
  assert.deepEqual(rewardForSession({ score: 1e12, mass: 1e12 }), { xp: 5000, pearls: 500 });
  assert.deepEqual(rewardForSession({ score: -10, mass: -2 }), { xp: 0, pearls: 0 });
});

test('skin catalog is canonical and cosmetics carry no gameplay authority', () => {
  const catalog = requireExport('SKIN_CATALOG');
  const skinById = requireExport('skinById');
  assert.ok(Array.isArray(catalog) && catalog.length >= 4);
  const starter = skinById('reef');
  assert.equal(starter.price, 0);
  assert.equal(starter.unlockLevel, 1);
  assert.equal(skinById('missing'), null);
  for (const skin of catalog) {
    assert.equal('speed' in skin, false);
    assert.equal('radius' in skin, false);
    assert.equal('mass' in skin, false);
    assert.ok(Number.isInteger(skin.price) && skin.price >= 0);
    assert.ok(Number.isInteger(skin.unlockLevel) && skin.unlockLevel >= 1);
  }
});
