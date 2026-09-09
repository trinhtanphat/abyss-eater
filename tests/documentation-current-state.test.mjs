import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('README documents the read-only production smoke flow', async () => {
  const readme = await readFile('README.md', 'utf8');
  assert.ok(readme.includes('Production smoke'));
  assert.ok(readme.includes('read-only'));
  assert.ok(readme.includes('four-player'));
  assert.ok(readme.includes('without deploying or mutating Cloudflare'));
});

test('original MVP plan is clearly historical and completed', async () => {
  const plan = await readFile('docs/superpowers/plans/2026-09-09-abyss-eater-mvp.md', 'utf8');
  assert.match(plan, /Status:\*\* Completed.*historical/i);
  assert.equal(plan.includes('- [ ]'), false);
  assert.ok(plan.includes('abyss-eater.qs3d.site'));
  assert.ok(plan.includes('connected Cloudflare deployment integration'));
});
