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
    'https://abyss-eater.hikvision.workers.dev/health',
    'https://abyss-eater.qs3d.site/health',
    'id="leaderboard"',
    'id="touch-joystick"',
    'client-progression.mjs',
    '/game/skins.js',
    'expected_cache=',
    'public/sw.js',
    'createProgressionClient',
    'skinVisual',
  ]) {
    assert.ok(workflow.includes(marker), `missing deploy workflow guard: ${marker}`);
  }
  assert.equal(workflow.includes('schedule:'), false, 'production deploy must not run on a recurring schedule');
  assert.equal(workflow.includes('wrangler@latest'), false, 'production deploy must use the repository-pinned Wrangler command');
  assert.equal(workflow.includes('abyss-eater-shell-v5'), false, 'production verify must not pin a stale shell cache version');
});
