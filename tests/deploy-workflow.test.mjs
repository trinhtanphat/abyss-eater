import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('GitHub automation stays CI-only and leaves production delivery to the connected platform', async () => {
  await assert.rejects(
    access('.github/workflows/deploy-production.yml'),
    'repository-managed production deploy workflow must stay absent',
  );

  const ci = await readFile('.github/workflows/ci.yml', 'utf8');
  for (const forbidden of ['wrangler deploy', 'deploy:game', 'deploy:gateway', 'CLOUDFLARE_API_TOKEN', 'd1 migrations apply']) {
    assert.equal(ci.includes(forbidden), false, `CI must not own production delivery: ${forbidden}`);
  }
});

test('CI records scale and exact-build evidence and probes live only after main pushes', async () => {
  const ci = await readFile('.github/workflows/ci.yml', 'utf8');
  for (const required of ['npm run profile:scale', 'node scripts/release-evidence.mjs', 'npm run probe:live', 'actions/upload-artifact@v7']) {
    assert.ok(ci.includes(required), `missing read-only qualification step: ${required}`);
  }
  assert.ok(ci.includes("github.event_name == 'push' && github.ref == 'refs/heads/main'"));
  for (const forbidden of ['CLOUDFLARE_API_TOKEN', 'wrangler deploy', 'd1 migrations apply']) {
    assert.equal(ci.includes(forbidden), false, `qualification must not mutate production: ${forbidden}`);
  }
});

test('GitHub actions use the current Node 24 action runtime generation', async () => {
  const workflows = await Promise.all([
    readFile('.github/workflows/ci.yml', 'utf8'),
    readFile('.github/workflows/production-smoke.yml', 'utf8'),
    readFile('.github/workflows/visual-review.yml', 'utf8'),
  ]);
  const combined = workflows.join('\n');
  assert.equal(combined.includes('actions/checkout@v4'), false, 'checkout v4 still targets deprecated Node 20');
  assert.equal(combined.includes('actions/setup-node@v4'), false, 'setup-node v4 still targets deprecated Node 20');
  assert.equal(combined.includes('actions/upload-artifact@v4'), false, 'upload-artifact v4 still targets deprecated Node 20');
  assert.ok(combined.includes('actions/checkout@v7'), 'checkout should use current Node 24 generation');
  assert.ok(combined.includes('actions/setup-node@v7'), 'setup-node should use current Node 24 generation');
  assert.ok(combined.includes('actions/upload-artifact@v7'), 'upload-artifact should use current Node 24 generation');
});
