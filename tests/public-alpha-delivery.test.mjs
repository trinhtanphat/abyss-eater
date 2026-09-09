import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const game = await import('../src/game-logic.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof game[name], 'function', `${name} must be implemented`);
  return game[name];
}

test('roomIdFor maps user room labels into a bounded deterministic Durable Object pool', () => {
  const roomIdFor = requireFn('roomIdFor');
  const first = roomIdFor(' Ocean   Crew ', 64);
  const second = roomIdFor('ocean crew', 64);
  assert.equal(first, second);
  assert.match(first, /^ocean-\d+$/);
  const slot = Number(first.slice('ocean-'.length));
  assert.ok(slot >= 1 && slot <= 64);
});

test('shouldBroadcast caps snapshots while allowing the first and boundary broadcast', () => {
  const shouldBroadcast = requireFn('shouldBroadcast');
  assert.equal(shouldBroadcast(0, 1, 50), true);
  assert.equal(shouldBroadcast(1000, 1049, 50), false);
  assert.equal(shouldBroadcast(1000, 1050, 50), true);
  assert.equal(shouldBroadcast(1100, 1099, 50), true);
});

test('Worker coalesces snapshots, carries food dirtiness, canonicalizes rooms and stops local respawn chaining', () => {
  const worker = readFileSync('src/worker.template.mjs', 'utf8');
  for (const marker of [
    'SNAPSHOT_MIN_INTERVAL_MS = 50',
    'ROOM_POOL_SIZE = 64',
    'this.lastBroadcastAt',
    'this.foodDirty',
    'shouldBroadcast',
    'roomIdFor',
    'playerWasEaten',
    'if (playerWasEaten) break',
  ]) {
    assert.ok(worker.includes(marker), `worker template must include ${marker}`);
  }
});

test('modular client accepts player-only delta snapshots and reuses GPU resources', () => {
  const state = readFileSync('public/game/state.js', 'utf8');
  assert.ok(state.includes('Array.isArray(next.food) ? next.food : snapshot.food'));

  const fish = readFileSync('public/game/fish.js', 'utf8');
  for (const marker of [
    'const BODY_GEOMETRY',
    'const TAIL_GEOMETRY',
    'const FIN_GEOMETRY',
    'const FOOD_GEOMETRY',
    'disposeFishRig',
  ]) {
    assert.ok(fish.includes(marker), `fish renderer must include ${marker}`);
  }
});

test('branded gateway serves static assets and runs code only for realtime/health routes', () => {
  const config = JSON.parse(readFileSync('wrangler.gateway.jsonc', 'utf8'));
  assert.equal(config.account_id, '50afb4fd3c4c7a1f3e1bdb7f22d4af7f');
  assert.equal(config.assets?.directory, './public');
  assert.equal(config.assets?.binding, 'ASSETS');
  assert.deepEqual(config.assets?.run_worker_first, ['/ws', '/health']);

  const gateway = readFileSync('gateway/worker.mjs', 'utf8');
  assert.ok(gateway.includes("url.pathname === '/ws'"));
  assert.ok(gateway.includes("url.pathname === '/health'"));
  assert.ok(gateway.includes('env.ASSETS.fetch(request)'));
});

test('Cloudflare deployment is account-pinned and Wrangler is version-pinned', () => {
  const gameConfig = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const gatewayConfig = JSON.parse(readFileSync('wrangler.gateway.jsonc', 'utf8'));
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(gameConfig.account_id, '6c5207813df3d5b83b9508125e0e9e12');
  assert.equal(gatewayConfig.account_id, '50afb4fd3c4c7a1f3e1bdb7f22d4af7f');
  assert.match(pkg.scripts?.['deploy:game'] ?? '', /wrangler@4\.129\.1/);
  assert.match(pkg.scripts?.['deploy:gateway'] ?? '', /wrangler@4\.129\.1/);
});

test('PWA exposes an offline shell plus 192 and 512 maskable install icons', () => {
  assert.equal(existsSync('public/sw.js'), true, 'public/sw.js must exist');
  assert.equal(existsSync('public/icon-192.svg'), true, '192 icon must exist');
  assert.equal(existsSync('public/icon-512.svg'), true, '512 icon must exist');
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  const iconSizes = new Set((manifest.icons ?? []).map((icon) => icon.sizes));
  assert.ok(iconSizes.has('192x192'));
  assert.ok(iconSizes.has('512x512'));
  assert.ok((manifest.icons ?? []).some((icon) => String(icon.purpose ?? '').includes('maskable')));
  const bootstrap = readFileSync('public/bootstrap.js', 'utf8');
  assert.ok(bootstrap.includes("navigator.serviceWorker.register('/sw.js'"));
});
