import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function render(env = {}) {
  rmSync('dist/wrangler.production.jsonc', { force: true });
  return spawnSync(process.execPath, ['scripts/render-production-wrangler.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('production Wrangler renderer fails closed without an existing D1 id', () => {
  let result = render({ ABYSS_EATER_D1_DATABASE_ID: '' });
  assert.notEqual(result.status, 0);
  assert.equal(existsSync('dist/wrangler.production.jsonc'), false);
  result = render({ ABYSS_EATER_D1_DATABASE_ID: 'not-a-database-id' });
  assert.notEqual(result.status, 0);
});

test('renderer adds PROFILE_DB while preserving account and GameRoom settings', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const result = render({ ABYSS_EATER_D1_DATABASE_ID: id });
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(readFileSync('dist/wrangler.production.jsonc', 'utf8'));
  assert.equal(config.account_id, '6c5207813df3d5b83b9508125e0e9e12');
  assert.equal(config.durable_objects.bindings[0].name, 'GAME_ROOM');
  assert.equal(config.main, 'worker.mjs');
  assert.deepEqual(config.d1_databases, [{ binding: 'PROFILE_DB', database_id: id, database_name: 'abyss-eater-profile', migrations_dir: '../migrations' }]);
});

test('manual production tooling stays explicit while GitHub Actions remains CI-only', () => {
  assert.equal(existsSync('.github/workflows/deploy-production.yml'), false, 'GitHub must not own production delivery');
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts?.['render:production'] ?? '', /render-production-wrangler\.mjs/);
  assert.match(pkg.scripts?.['deploy:game'] ?? '', /render:production/);
  assert.match(pkg.scripts?.['deploy:game'] ?? '', /dist\/wrangler\.production\.jsonc/);
  assert.match(pkg.scripts?.['deploy:gateway'] ?? '', /wrangler@4\.129\.1/);
});

test('source config and GitHub CI contain no production provisioning or mutation', () => {
  const wrangler = readFileSync('wrangler.jsonc', 'utf8');
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.equal(wrangler.includes('database_id'), false);
  assert.equal(wrangler.includes('PROFILE_DB'), false);
  for (const forbidden of ['d1 create', 'd1 migrations apply', 'wrangler deploy', 'CLOUDFLARE_API_TOKEN', 'SESSION_SIGNING_KEY']) {
    assert.equal(ci.includes(forbidden), false, `CI must stay validation-only: ${forbidden}`);
  }
});
