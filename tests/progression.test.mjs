import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LEVEL,
  SKIN_CATALOG,
  levelForXp,
  rewardForCheckpoint,
  skinById,
} from '../src/progression.mjs';

test('levelForXp uses 1000 XP steps and caps at MAX_LEVEL', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(999), 1);
  assert.equal(levelForXp(1000), 2);
  assert.equal(levelForXp(Number.POSITIVE_INFINITY), 1);
  assert.equal(levelForXp(10 ** 9), MAX_LEVEL);
});

test('rewardForCheckpoint is deterministic and bounded', () => {
  assert.deepEqual(
    rewardForCheckpoint({ scoreDelta: 1000, peakMass: 4, playerEats: 2, survivedMs: 60000 }),
    { xp: 316, pearls: 1 },
  );
  assert.deepEqual(
    rewardForCheckpoint({ scoreDelta: Infinity, peakMass: -5, playerEats: 999, survivedMs: Infinity }),
    { xp: 1500, pearls: 6 },
  );
});

test('skin catalog contains visual-only cosmetics and safe lookup', () => {
  assert.ok(SKIN_CATALOG.length >= 3);
  for (const skin of SKIN_CATALOG) {
    assert.equal(typeof skin.id, 'string');
    assert.equal(typeof skin.title, 'string');
    assert.ok(Number.isInteger(skin.unlockLevel));
    assert.ok(Number.isInteger(skin.pearlCost));
    assert.equal(typeof skin.visual, 'object');
    for (const forbidden of ['mass', 'speed', 'radius', 'hitbox', 'collision']) {
      assert.equal(Object.hasOwn(skin, forbidden), false);
      assert.equal(Object.hasOwn(skin.visual, forbidden), false);
    }
  }
  assert.equal(skinById('missing'), null);
  assert.equal(skinById(SKIN_CATALOG[0].id)?.id, SKIN_CATALOG[0].id);
});
