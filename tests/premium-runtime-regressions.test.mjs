import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('premium mouse-look state is wired through input into the follow camera', async () => {
  const [app, input, scene] = await Promise.all([
    readFile('public/app.js', 'utf8'),
    readFile('public/game/input.js', 'utf8'),
    readFile('public/game/scene.js', 'utf8'),
  ]);

  assert.ok(input.includes('look() {'), 'input controller must expose current look yaw/pitch');
  assert.ok(app.includes('sceneContext.follow(cameraTarget, cameraMass, delta, input.look())'), 'app must pass look state into camera follow');
  assert.ok(scene.includes('function follow(target, mass = 1, delta = 1 / 60, look = {})'), 'camera follow must accept look state');
  assert.ok(scene.includes('const yaw = Number(look.yaw) || 0;'), 'camera follow must consume yaw');
  assert.ok(scene.includes('const pitch = Number(look.pitch) || 0;'), 'camera follow must consume pitch');
  assert.ok(scene.includes('camera.lookAt(lookTarget);'), 'camera must look along the computed look target');
});

test('departed and lobby fish release private GPU resources', async () => {
  const [app, fish] = await Promise.all([
    readFile('public/app.js', 'utf8'),
    readFile('public/game/fish.js', 'utf8'),
  ]);

  assert.ok(fish.includes('export function disposeFishRig'), 'fish renderer must expose cleanup');
  assert.ok(fish.includes('glowGeometry'), 'private glow geometry must be tracked for cleanup');
  assert.ok(fish.includes('data.glowGeometry?.dispose?.();'), 'private glow geometry must be disposed');
  assert.ok(fish.includes('for (const material of materials) material?.dispose?.();'), 'per-rig materials must be disposed');
  assert.ok(app.includes('disposeFishRig(rig);'), 'departed multiplayer rigs must be disposed');
  assert.ok(app.includes('disposeFishRig(demoFish);'), 'lobby demo rig must be disposed after dive');
});
