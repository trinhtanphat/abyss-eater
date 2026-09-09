import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterpolationBuffer, frameIndependentAlpha, renderServerTime } from '../public/game/interpolation.mjs';

test('remote interpolation buffer keeps bounded ordered samples and interpolates position', () => {
  const buffer = createInterpolationBuffer({ maxSamples: 4 });
  buffer.push({ x: 0, y: 0, z: 0 }, 900, 100);
  buffer.push({ x: 5, y: 2, z: -5 }, 950, 150);
  buffer.push({ x: 10, y: 4, z: -10 }, 1000, 200);
  const sample = buffer.sample(975);
  assert.deepEqual(sample, { x: 7.5, y: 3, z: -7.5 });
  buffer.push({ x: 15, y: 6, z: -15 }, 1050, 250);
  buffer.push({ x: 20, y: 8, z: -20 }, 1100, 300);
  assert.equal(buffer.size, 4);
  assert.deepEqual(buffer.sample(500), { x: 5, y: 2, z: -5 });
  assert.deepEqual(buffer.sample(5000), { x: 20, y: 8, z: -20 });
});

test('render time stays behind latest server time by the bounded interpolation delay', () => {
  assert.equal(renderServerTime({ latestServerTime: 1000, latestReceivedAt: 200, now: 225, delayMs: 100 }), 925);
  assert.equal(renderServerTime({ latestServerTime: 1000, latestReceivedAt: 200, now: 1000, delayMs: 100 }), 1050);
});

test('exponential easing is frame-rate independent', () => {
  const full = frameIndependentAlpha(10, 1 / 30);
  const half = frameIndependentAlpha(10, 1 / 60);
  const composed = 1 - ((1 - half) * (1 - half));
  assert.ok(Math.abs(full - composed) < 1e-12);
  assert.ok(full > 0 && full < 1);
});

import { readFile } from 'node:fs/promises';

test('game wires remote server-time interpolation without changing local authority', async () => {
  const [fish, app, sw] = await Promise.all([
    readFile('public/game/fish.js', 'utf8'),
    readFile('public/app.js', 'utf8'),
    readFile('public/sw.js', 'utf8'),
  ]);
  assert.ok(fish.includes("from './interpolation.mjs'"));
  assert.ok(fish.includes('createInterpolationBuffer'));
  assert.ok(fish.includes('data.interpolation.push'));
  assert.ok(fish.includes('if (!local && data.interpolation.size'));
  assert.ok(fish.includes('frameIndependentAlpha'));
  assert.ok(app.includes('serverTime: state.snapshot.serverTime'));
  assert.ok(app.includes('receivedAt: snapshotReceivedAt'));
  assert.ok(app.includes('animateFishRig(rig, time, id === state.clientId, delta)'));
  assert.ok(sw.includes("'/game/interpolation.mjs'"));
});
