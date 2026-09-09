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

test('production workflow renders config, verifies secret, migrates D1, then deploys', () => {
  const workflow = readFileSync('.github/workflows/deploy-production.yml', 'utf8');
  const packageJson = readFileSync('package.json', 'utf8');
  for (const marker of [
    'ABYSS_EATER_D1_DATABASE_ID',
    'render-production-wrangler.mjs',
    'SESSION_SIGNING_KEY',
    'secret list',
    'd1 migrations apply PROFILE_DB',
    '--config dist/wrangler.production.jsonc',
  ]) assert.ok(workflow.includes(marker) || packageJson.includes(marker), `missing deploy marker: ${marker}`);
  const renderAt = workflow.indexOf('render-production-wrangler.mjs');
  const migrateAt = workflow.indexOf('d1 migrations apply PROFILE_DB');
  const deployAt = workflow.indexOf('Deploy authoritative game Worker');
  assert.ok(renderAt >= 0 && migrateAt > renderAt && deployAt > migrateAt);
});

test('source Wrangler contains no production D1 id or billable-resource provisioning', () => {
  const wrangler = readFileSync('wrangler.jsonc', 'utf8');
  const workflow = readFileSync('.github/workflows/deploy-production.yml', 'utf8');
  assert.equal(wrangler.includes('database_id'), false);
  assert.equal(wrangler.includes('PROFILE_DB'), false);
  assert.equal(/d1\s+create/i.test(workflow), false);
  assert.equal(/subscription\\s+create|plan\\s+upgrade|workers\\s+paid\\s+(enable|create)/i.test(workflow), false);
});



test('production smoke verifies persistence health and branded Carrier 3 API proxy', () => {
  const workflow = readFileSync('.github/workflows/deploy-production.yml', 'utf8');
  for (const marker of [
    '\"persistence\":\"configured\"',
    'base=https://abyss-eater.qs3d.site',
    '$base/api/skins',
    '$base/api/leaderboard?season=all-time&limit=5',
    '\"ok\":true',
  ]) {
    assert.ok(workflow.includes(marker), `missing Carrier 3 production smoke marker: ${marker}`);
  }
});
