import test from 'node:test';
import assert from 'node:assert/strict';

const input = await import('../src/client-input.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof input[name], 'function', `${name} must be implemented`);
  return input[name];
}

test('cameraRelativeDirection sends forward movement along the current yaw', () => {
  const cameraRelativeDirection = requireFn('cameraRelativeDirection');

  const north = cameraRelativeDirection({ forward: 1, strafe: 0, vertical: 0 }, 0, 0);
  assert.ok(Math.abs(north.x) < 1e-9);
  assert.ok(Math.abs(north.y) < 1e-9);
  assert.ok(Math.abs(north.z + 1) < 1e-9);

  const left = cameraRelativeDirection({ forward: 1, strafe: 0, vertical: 0 }, Math.PI / 2, 0);
  assert.ok(Math.abs(left.x + 1) < 1e-9);
  assert.ok(Math.abs(left.z) < 1e-9);
});

test('cameraRelativeDirection follows pitch while preserving explicit vertical swim', () => {
  const cameraRelativeDirection = requireFn('cameraRelativeDirection');
  const dir = cameraRelativeDirection({ forward: 1, strafe: 0, vertical: 1 }, 0, Math.PI / 6);

  assert.ok(dir.y > 0.5);
  assert.ok(dir.z < 0);
  assert.ok(Math.hypot(dir.x, dir.y, dir.z) <= 1 + 1e-9);
});

test('cameraRelativeDirection normalizes diagonal movement', () => {
  const cameraRelativeDirection = requireFn('cameraRelativeDirection');
  const dir = cameraRelativeDirection({ forward: 1, strafe: 1, vertical: 0 }, Math.PI / 4, 0);
  assert.ok(Math.abs(Math.hypot(dir.x, dir.y, dir.z) - 1) < 1e-9);
});

test('updateLook applies mouse sensitivity and clamps pitch', () => {
  const updateLook = requireFn('updateLook');
  const look = updateLook({ yaw: 0, pitch: 0 }, 100, -1000, 0.0025, Math.PI * 0.46);

  assert.ok(Math.abs(look.yaw + 0.25) < 1e-9);
  assert.ok(Math.abs(look.pitch - Math.PI * 0.46) < 1e-9);
});

test('updateLook wraps yaw so long mouse sessions stay numerically stable', () => {
  const updateLook = requireFn('updateLook');
  const look = updateLook({ yaw: Math.PI - 0.01, pitch: 0 }, -100, 0, 0.01, Math.PI * 0.46);
  assert.ok(look.yaw >= -Math.PI && look.yaw <= Math.PI);
});
