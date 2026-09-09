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

test('plan index marks carriers 1-6 done and Carrier 7 qualification explicit', async () => {
  const plan = await readFile('docs/superpowers/plans/2026-09-09-v1-plan-index.md', 'utf8');
  for (let carrier = 1; carrier <= 6; carrier += 1) assert.ok(plan.includes(`Carrier ${carrier}: DONE`));
  assert.ok(plan.includes('Carrier 7: QUALIFICATION'));
});

test('V1 qualification document is fail-closed and explains exact-head evidence', async () => {
  const doc = await readFile('docs/releases/v1-qualification.md', 'utf8');
  for (const marker of ['release-evidence.json', 'live-probe.json', 'exact Git SHA', 'Worker SHA-256', 'no paid service', 'Rollback']) {
    assert.ok(doc.includes(marker), `qualification missing ${marker}`);
  }
  assert.ok(doc.includes('connected Cloudflare deployment integration'));
});
