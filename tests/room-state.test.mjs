import test from 'node:test';
import assert from 'node:assert/strict';

const roomState = await import('../src/room-state.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof roomState[name], 'function', `${name} must be implemented`);
  return roomState[name];
}

test('reconnect slot has an exact twelve second grace boundary', () => {
  const makeReconnectSlot = requireFn('makeReconnectSlot');
  const isReconnectSlotExpired = requireFn('isReconnectSlotExpired');
  assert.equal(roomState.RECONNECT_GRACE_MS, 12000);
  const player = { id: 'p1', name: 'Fish', mass: 4, score: 200, deaths: 1, position: { x: 1, y: 2, z: 3 } };
  const slot = makeReconnectSlot(player, 'resume-key', 1000);
  assert.equal(isReconnectSlotExpired(slot, 12999), false);
  assert.equal(isReconnectSlotExpired(slot, 13000), true);
});

test('makeReconnectSlot preserves competitive state but disables interaction', () => {
  const makeReconnectSlot = requireFn('makeReconnectSlot');
  const player = {
    id: 'p1', name: 'Fish', room: 'ocean-1', mass: 7, score: 900, deaths: 3,
    seq: 44, lastAt: 2000, interactive: true, position: { x: 4, y: 5, z: 6 },
  };
  const slot = makeReconnectSlot(player, 'opaque', 3000);
  assert.equal(slot.id, 'p1');
  assert.equal(slot.mass, 7);
  assert.equal(slot.score, 900);
  assert.equal(slot.deaths, 3);
  assert.deepEqual(slot.position, { x: 4, y: 5, z: 6 });
  assert.equal(slot.resumeKey, 'opaque');
  assert.equal(slot.disconnectedAt, 3000);
  assert.equal(slot.interactive, false);
});

test('canResume requires the exact unexpired opaque key', () => {
  const makeReconnectSlot = requireFn('makeReconnectSlot');
  const canResume = requireFn('canResume');
  const slot = makeReconnectSlot({ id: 'p1', mass: 1, position: { x: 0, y: 0, z: 0 } }, 'correct-key', 5000);
  assert.equal(canResume(slot, 'correct-key', 16999), true);
  assert.equal(canResume(slot, 'wrong-key', 16999), false);
  assert.equal(canResume(slot, 'correct-key', 17000), false);
  assert.equal(canResume(slot, '', 6000), false);
});

test('makeResumeKey produces distinct opaque values and rate state starts empty', () => {
  const makeResumeKey = requireFn('makeResumeKey');
  const makeRateState = requireFn('makeRateState');
  const first = makeResumeKey();
  const second = makeResumeKey();
  assert.equal(typeof first, 'string');
  assert.ok(first.length >= 32);
  assert.notEqual(first, second);
  assert.deepEqual(makeRateState(), { startedAt: 0, count: 0 });
});