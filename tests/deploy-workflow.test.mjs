import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('GitHub automation stays CI-only and leaves production delivery to the connected platform', async () => {
  await assert.rejects(
    access('.github/workflows/deploy-production.yml'),
    'repository-managed production deploy workflow must stay absent',
  );

  const ci = await readFile('.github/workflows/ci.yml', 'utf8');
  for (const forbidden of ['wrangler deploy', 'deploy:game', 'deploy:gateway', 'CLOUDFLARE_API_TOKEN']) {
    assert.equal(ci.includes(forbidden), false, `CI must not own production delivery: ${forbidden}`);
  }
});
