import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('README describes implemented Full A+B+C social/world/scale state without stale deferred claims', async () => {
  const readme = await readFile('README.md', 'utf8');
  for (const marker of ['Quick Dive', 'party', 'room chat', 'hazards', 'pickups', 'JSON_KEEP', '9,926']) {
    assert.ok(readme.includes(marker), `README missing ${marker}`);
  }
  assert.equal(readme.includes('chat, parties, regional matchmaking'), false);
  assert.ok(readme.includes('binary snapshots remain intentionally deferred'));
});

test('runbook documents social DOs, release evidence, live probes and CI-only delivery', async () => {
  const runbook = await readFile('docs/runbooks/multiplayer-hardening.md', 'utf8');
  for (const marker of ['MATCHMAKER -> Matchmaker', 'PARTY -> Party', 'type":"chat', 'npm run release:evidence', 'npm run probe:live', 'CI-only']) {
    assert.ok(runbook.includes(marker), `runbook missing ${marker}`);
  }
  assert.equal(runbook.includes('Production workflow order is strict'), false);
});

test('plan index marks all seven carriers done', async () => {
  const plan = await readFile('docs/superpowers/plans/2026-09-09-v1-plan-index.md', 'utf8');
  for (let carrier = 1; carrier <= 7; carrier += 1) assert.ok(plan.includes(`Carrier ${carrier}: DONE`));
});

test('V1 qualification document is fail-closed and explains exact-head evidence', async () => {
  const doc = await readFile('docs/releases/v1-qualification.md', 'utf8');
  for (const marker of ['release-evidence.json', 'live-probe.json', 'exact Git SHA', 'Worker SHA-256', 'no paid service', 'Rollback', 'v1-full-abc', '34361234094', 'c55f2db52e82c491d29b47dc29b9c9fb39cb2a05']) {
    assert.ok(doc.includes(marker), `qualification missing ${marker}`);
  }
  assert.ok(doc.includes('connected Cloudflare deployment integration'));
});
