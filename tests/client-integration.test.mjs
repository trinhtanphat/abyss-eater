import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('mouse look is wired through input state into the follow camera', async () => {
  const [input, app, scene] = await Promise.all([
    readFile('public/game/input.js', 'utf8'),
    readFile('public/app.js', 'utf8'),
    readFile('public/game/scene.js', 'utf8'),
  ]);

  assert.ok(input.includes('look() {'), 'input controller must expose current yaw/pitch');
  assert.ok(app.includes('sceneContext.follow(cameraTarget, cameraMass, delta, input.look())'), 'app must pass input look state into scene follow');
  assert.ok(scene.includes('function follow(target, mass = 1, delta = 1 / 60, look = {})'), 'scene follow must accept look state');
  assert.ok(scene.includes('const yaw = Number(look.yaw) || 0;'), 'camera follow must use yaw');
  assert.ok(scene.includes('const pitch = Number(look.pitch) || 0;'), 'camera follow must use pitch');
});

test('departed fish release per-rig GPU resources', async () => {
  const [fish, app] = await Promise.all([
    readFile('public/game/fish.js', 'utf8'),
    readFile('public/app.js', 'utf8'),
  ]);

  assert.ok(fish.includes('export function disposeFishRig'), 'fish module must expose a rig cleanup helper');
  assert.ok(fish.includes('glowGeometry'), 'rig cleanup must track its private glow geometry');
  assert.ok(app.includes('disposeFishRig(rig);'), 'snapshot removal must dispose departed rigs');
});
