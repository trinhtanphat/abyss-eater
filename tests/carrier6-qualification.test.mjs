import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

test('Carrier 6 documents measured JSON evidence and keeps binary deferred', async () => {
  const [readme, evidence, pkg] = await Promise.all([
    readFile('README.md', 'utf8'),
    readFile('docs/performance/carrier-6-network-profile.md', 'utf8'),
    readFile('package.json', 'utf8'),
  ]);
  assert.match(readme, /20-player.*13,135 B/i);
  assert.match(readme, /binary.*evidence-deferred/i);
  assert.ok(evidence.includes('13,135'));
  assert.ok(evidence.includes('3,084'));
  assert.ok(evidence.includes('json_within_budget'));
  assert.ok(pkg.includes('"profile:network": "node scripts/profile-network.mjs"'));
});

test('Carrier 6 exposes no binary codec/debug endpoint or GitHub deploy mutation', async () => {
  const [worker, app, workflows] = await Promise.all([
    readFile('src/worker.template.mjs', 'utf8'),
    readFile('public/app.js', 'utf8'),
    readdir('.github/workflows'),
  ]);
  assert.equal(/binary(snapshot|codec)/i.test(worker), false);
  assert.equal(/\/api\/(metrics|debug|network-profile)/.test(worker), false);
  assert.ok(app.includes('if (!started || document.hidden) return false;'));
  assert.equal(workflows.includes('deploy-production.yml'), false);
  assert.equal(workflows.some((name) => /deploy/i.test(name)), false);
});
