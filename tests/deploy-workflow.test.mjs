import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production deploy workflow is manual plus one-shot-on-workflow-file push', async () => {
  const workflow = await readFile('.github/workflows/deploy-production.yml', 'utf8');
  for (const marker of [
    'workflow_dispatch:',
    "paths:\n      - '.github/workflows/deploy-production.yml'",
    'cancel-in-progress: false',
    'npm run check',
    'npm run deploy:game',
    'npm run deploy:gateway',
    'CLOUDFLARE_API_TOKEN_6666',
    'CLOUDFLARE_API_TOKEN_2403',
    'No Cloudflare API token; skipping Wrangler mutation and verifying externally managed production.',
    'https://abyss-eater.hikvision.workers.dev/health',
    'https://abyss-eater.qs3d.site/health',
    'id="leaderboard"',
    'id="touch-joystick"',
    'vi_VN-vais1000-medium',
    'abyss-eater-shell-v5',
  ]) {
    assert.ok(workflow.includes(marker), `missing deploy workflow guard: ${marker}`);
  }
  assert.equal(workflow.includes('schedule:'), false, 'production deploy must not run on a recurring schedule');
  assert.equal(workflow.includes('wrangler@latest'), false, 'production deploy must use the repository-pinned Wrangler command');
  assert.equal(workflow.includes('Missing CLOUDFLARE_API_TOKEN_6666'), false, 'missing token must fall through to live verification rather than fail before it');
  assert.equal(workflow.includes('Missing CLOUDFLARE_API_TOKEN_2403'), false, 'missing gateway token must fall through to live verification rather than fail before it');
});
