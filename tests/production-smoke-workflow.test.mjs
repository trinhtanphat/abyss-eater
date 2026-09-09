import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const normalized = (value) => value.replace(/\r\n/g, '\n');

test('production smoke follows green current main without Cloudflare mutation', async () => {
  const workflow = normalized(await readFile('.github/workflows/production-smoke.yml', 'utf8'));
  for (const marker of [
    'name: Production smoke',
    'workflow_dispatch:',
    'workflow_run:',
    'workflows: [CI]',
    'types: [completed]',
    'cancel-in-progress: true',
    "github.event.workflow_run.head_branch == 'main'",
    "github.event.workflow_run.conclusion == 'success'",
    'github.event.workflow_run.head_sha == github.sha',
    'node scripts/production-smoke.mjs',
  ]) {
    assert.ok(workflow.includes(marker), `missing smoke guard: ${marker}`);
  }

  for (const forbidden of [
    'wrangler',
    'deploy:game',
    'deploy:gateway',
    'CLOUDFLARE_API_TOKEN',
    'CF_ACCOUNT_ID',
    'd1 migrations',
    'SESSION_SIGNING_KEY',
    'secrets.',
  ]) {
    assert.equal(workflow.includes(forbidden), false, `smoke workflow must stay read-only: ${forbidden}`);
  }
});
