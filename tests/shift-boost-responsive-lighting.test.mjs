import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const game = await import('../src/game-logic.mjs').catch(() => ({}));
const protocol = await import('../src/protocol.mjs').catch(() => ({}));

function requireFn(module, name) {
  assert.equal(typeof module[name], 'function', `${name} must be implemented`);
  return module[name];
}

test('manual Shift boost is immediate and score drain starts only after three seconds', () => {
  const updateManualBoostState = requireFn(game, 'updateManualBoostState');
  const movementMultiplierForPlayer = requireFn(game, 'movementMultiplierForPlayer');

  const started = updateManualBoostState({ score: 20 }, true, 1_000);
  assert.equal(started.manualBoostActive, true);
  assert.equal(started.manualBoostStartedAt, 1_000);
  assert.equal(started.score, 20);
  assert.equal(movementMultiplierForPlayer(started, 1_000), 1.55);

  const graceBoundary = updateManualBoostState(started, true, 4_000);
  assert.equal(graceBoundary.score, 20);
  const oneSecondOver = updateManualBoostState(graceBoundary, true, 5_000);
  assert.equal(oneSecondOver.score, 15);
});

test('manual boost drain is incremental, floors score at zero, and resets on release', () => {
  const updateManualBoostState = requireFn(game, 'updateManualBoostState');
  let player = updateManualBoostState({ score: 8 }, true, 10_000);
  player = updateManualBoostState(player, true, 14_000);
  assert.equal(player.score, 3);
  player = updateManualBoostState(player, true, 15_000);
  assert.equal(player.score, 0);
  const released = updateManualBoostState(player, false, 15_100);
  assert.equal(released.manualBoostActive, false);
  assert.equal(released.manualBoostStartedAt, 0);
  assert.equal(released.manualBoostDrained, 0);
  const restarted = updateManualBoostState(released, true, 15_200);
  assert.equal(restarted.manualBoostStartedAt, 15_200);
  assert.equal(restarted.score, 0);
});

test('protocol accepts a bounded boolean boost flag and rejects non-boolean boost authority', () => {
  const parseClientMessage = requireFn(protocol, 'parseClientMessage');
  assert.deepEqual(
    parseClientMessage('{"type":"input","v":2,"seq":7,"dir":{"x":1,"y":0,"z":0},"boost":true}'),
    { ok: true, message: { type: 'input', v: 2, seq: 7, dir: { x: 1, y: 0, z: 0 }, boost: true } },
  );
  assert.deepEqual(
    parseClientMessage('{"type":"input","v":2,"seq":8,"dir":{"x":0,"y":0,"z":0}}'),
    { ok: true, message: { type: 'input', v: 2, seq: 8, dir: { x: 0, y: 0, z: 0 }, boost: false } },
  );
  assert.deepEqual(
    parseClientMessage('{"type":"input","v":2,"seq":9,"dir":{"x":0,"y":0,"z":0},"boost":1}'),
    { ok: false, code: 'bad_boost' },
  );
});

test('desktop controls reserve Shift for boost and move descend to C', async () => {
  const [input, network, app, html] = await Promise.all([
    readFile('public/game/input.js', 'utf8'),
    readFile('public/game/network.js', 'utf8'),
    readFile('public/app.js', 'utf8'),
    readFile('public/index.html', 'utf8'),
  ]);
  assert.match(input, /keys\.has\('KeyC'\).*verticalAmount -= 1/s);
  assert.doesNotMatch(input, /keys\.has\('ShiftLeft'\).*verticalAmount -= 1/s);
  assert.match(input, /boosting\(\)[\s\S]*ShiftLeft[\s\S]*ShiftRight/);
  assert.match(network, /sendInput\(dir, boost = false\)/);
  assert.match(network, /type: 'input'[\s\S]*boost: Boolean\(boost\)/);
  assert.ok(app.includes('network.sendInput(input.direction(), input.boosting())'));
  assert.ok(html.includes('<kbd>SHIFT</kbd> Boost'));
  assert.ok(html.includes('<kbd>C</kbd> Descend'));
});
test('lobby has a true narrow-screen reflow and dynamic viewport scrolling', async () => {
  const css = await readFile('public/styles.css', 'utf8');
  assert.match(css, /\.lobby-shell\s*\{[\s\S]*min-height:\s*100dvh/);
  assert.match(css, /@media\s*\(max-width:\s*520px\)[\s\S]*\.field-row\s*\{\s*grid-template-columns:\s*1fr;/);
  assert.match(css, /@media\s*\(max-width:\s*520px\)[\s\S]*\.skin-grid\s*\{\s*grid-template-columns:\s*repeat\(2,/);
  assert.match(css, /@media\s*\(max-height:\s*720px\)[\s\S]*\.lobby-shell[\s\S]*overflow-y:\s*auto/);
});

test('scene and fish presentation lift exposure and keep non-local fish visibly luminous', async () => {
  const [scene, fish, themes] = await Promise.all([
    readFile('public/game/scene.js', 'utf8'),
    readFile('public/game/fish.js', 'utf8'),
    readFile('public/game/themes.js', 'utf8'),
  ]);
  assert.ok(scene.includes('THREE.ACESFilmicToneMapping'));
  assert.match(scene, /toneMappingExposure\s*=\s*1\.[1-9]/);
  assert.match(fish, /opacity:\s*isLocal\s*\?\s*0\.\d+\s*:\s*0\.0[1-9]/);
  assert.match(fish, /emissiveIntensity:\s*isLocal\s*\?\s*1\.[0-9]+\s*:\s*0\.[6-9]/);
  assert.match(themes, /id:\s*'deep-sea'[\s\S]*hemi:\s*0\.[89]/);
});
