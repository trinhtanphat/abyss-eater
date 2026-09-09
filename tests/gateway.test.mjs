import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('cross-account gateway forwards the full request to the 6666 workers.dev origin', async () => {
  const source = await readFile(new URL('../gateway/worker.mjs', import.meta.url), 'utf8');
  assert.match(source, /abyss-eater\.hikvision\.workers\.dev/);
  assert.match(source, /new Request\(upstream, request\)/);
  assert.match(source, /return fetch\(proxiedRequest\)/);
});

test('gateway Wrangler config owns only the branded 2403 custom domain', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.gateway.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.name, 'abyss-eater-gateway');
  assert.equal(config.account_id, '50afb4fd3c4c7a1f3e1bdb7f22d4af7f');
  assert.equal(config.workers_dev, false);
  assert.deepEqual(config.routes, [{ pattern: 'abyss-eater.qs3d.site', custom_domain: true }]);
});


test('gateway proxies Carrier 3 APIs while keeping ordinary static assets local', async () => {
  const source = await readFile(new URL('../gateway/worker.mjs', import.meta.url), 'utf8');
  assert.match(source, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(source, /url\.pathname === '\/ws'/);
  assert.match(source, /url\.pathname === '\/health'/);
  assert.match(source, /env\.ASSETS\.fetch\(request\)/);

  const config = JSON.parse(await readFile(new URL('../wrangler.gateway.jsonc', import.meta.url), 'utf8'));
  assert.ok(config.assets?.run_worker_first?.includes('/api/*'));
  assert.ok(config.assets?.run_worker_first?.includes('/ws'));
  assert.ok(config.assets?.run_worker_first?.includes('/health'));
});
