import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const game = await import('../src/game-logic.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof game[name], 'function', `${name} must be implemented`);
  return game[name];
}

test('roomIdFor deterministically maps arbitrary labels into a bounded Durable Object pool', () => {
  const roomIdFor = requireFn('roomIdFor');
  const first = roomIdFor('Ocean   Crew', 64);
  const second = roomIdFor('ocean crew', 64);
  assert.equal(first, second);
  assert.match(first, /^ocean-\d+$/);
  const slot = Number(first.split('-')[1]);
  assert.ok(slot >= 1 && slot <= 64);
});

test('consumeRateLimit rejects message floods and resets after the rolling window', () => {
  const consumeRateLimit = requireFn('consumeRateLimit');
  let state = undefined;
  for (let i = 0; i < 30; i += 1) {
    const result = consumeRateLimit(state, 1000 + i, 30, 1000);
    assert.equal(result.allowed, true);
    state = result.state;
  }
  const blocked = consumeRateLimit(state, 1050, 30, 1000);
  assert.equal(blocked.allowed, false);
  const reset = consumeRateLimit(blocked.state, 2101, 30, 1000);
  assert.equal(reset.allowed, true);
  assert.equal(reset.state.count, 1);
});

test('shouldBroadcast caps room snapshots to a minimum interval', () => {
  const shouldBroadcast = requireFn('shouldBroadcast');
  assert.equal(shouldBroadcast(1000, 1049, 50), false);
  assert.equal(shouldBroadcast(1000, 1050, 50), true);
  assert.equal(shouldBroadcast(0, 1, 50), true);
});

test('Worker template wires hardening helpers and stops collision chaining after local respawn', () => {
  const worker = readFileSync('src/worker.template.mjs', 'utf8');
  for (const marker of ['consumeRateLimit', 'shouldBroadcast', 'playerWasEaten', 'includeFood']) {
    assert.ok(worker.includes(marker), `worker template must include ${marker}`);
  }
});

test('gateway config serves frontend as Workers Static Assets and invokes code only for realtime routes', () => {
  const config = JSON.parse(readFileSync('wrangler.gateway.jsonc', 'utf8'));
  assert.equal(config.account_id, '50afb4fd3c4c7a1f3e1bdb7f22d4af7f');
  assert.equal(config.assets?.directory, './public');
  assert.deepEqual(config.assets?.run_worker_first, ['/ws', '/health']);
});

test('game deployment is pinned to the 6666 account and an exact Wrangler version', () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(config.account_id, '6c5207813df3d5b83b9508125e0e9e12');
  assert.match(pkg.scripts?.['deploy:game'] ?? '', /wrangler@4\.130\.0/);
  assert.match(pkg.scripts?.['deploy:gateway'] ?? '', /wrangler@4\.130\.0/);
});

test('PWA has an offline service worker and install icons', () => {
  assert.equal(existsSync('public/sw.js'), true, 'public/sw.js must exist');
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  const iconSizes = new Set((manifest.icons ?? []).map((icon) => icon.sizes));
  assert.ok(iconSizes.has('192x192'));
  assert.ok(iconSizes.has('512x512'));
  const html = readFileSync('public/index.html', 'utf8');
  assert.ok(html.includes("navigator.serviceWorker.register('/sw.js')"));
});
