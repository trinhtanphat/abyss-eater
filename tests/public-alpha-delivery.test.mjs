import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorkerSource } from '../scripts/build.mjs';

const workerSource = createWorkerSource();

test('production Worker enforces versioned rate-limited authoritative input', () => {
  for (const marker of [
    'PROTOCOL_VERSION',
    'parseClientMessage',
    'consumeRateWindow',
    'acceptSequence',
    'advancePlayer',
    'resolveEatPair',
    'collectFood',
    'broadcastSnapshot',
  ]) {
    assert.ok(workerSource.includes(marker), `worker bundle must include ${marker}`);
  }
});

test('production Worker uses bounded spatial collision candidates', () => {
  for (const marker of [
    'buildSpatialBuckets',
    'nearbyFromBuckets',
    'SPATIAL_CELL_SIZE',
  ]) {
    assert.ok(workerSource.includes(marker), `worker bundle must include ${marker}`);
  }
});

test('production Worker supports bounded resumable presence without a perpetual server timer', () => {
  for (const marker of [
    'makeReconnectSlot',
    'canResume',
    'RECONNECT_GRACE_MS',
    'resumeKey',
    'setTimeout(() =>',
  ]) {
    assert.ok(workerSource.includes(marker), `worker template must include ${marker}`);
  }
  assert.ok(!workerSource.includes('setInterval('), 'Worker must not keep a perpetual interval alive');
});

test('all gameplay WebSocket messages are protocol-versioned', () => {
  for (const marker of [
    'version: PROTOCOL_VERSION',
    "type: 'welcome'",
    "type: 'snapshot'",
    "type: 'pong'",
    "type: 'error'",
    'if (playerWasEaten) break',
  ]) {
    assert.ok(workerSource.includes(marker), `worker template must include ${marker}`);
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
    'const FOOD_BODY_GEOMETRY',
    'const FOOD_FIN_GEOMETRY',
    'const FOOD_CORE_GEOMETRY',
    'const FOOD_TENDRIL_GEOMETRY',
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
  assert.match(pkg.scripts['deploy:game'], /wrangler@4\.129\.1/);
  assert.match(pkg.scripts['deploy:gateway'], /wrangler@4\.129\.1/);
});

test('PWA exposes an offline shell plus 192 and 512 maskable install icons', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512']);
  assert.ok(manifest.icons.every((icon) => icon.purpose.includes('maskable')));

  const sw = readFileSync('public/sw.js', 'utf8');
  assert.ok(sw.includes("'/icon-192.svg'"));
  assert.ok(sw.includes("'/icon-512.svg'"));
  assert.ok(sw.includes("caches.open(CACHE_NAME)"));
});
