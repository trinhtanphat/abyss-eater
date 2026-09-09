import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Carrier 6 artifact records required V1 scale metrics and JSON_KEEP decision', async () => {
  const report = JSON.parse(await readFile('artifacts/carrier6-scale-profile.json', 'utf8'));
  assert.equal(report.iterationsPerCase, 2000);
  assert.equal(report.snapshotHzCap, 20);
  assert.equal(report.thresholds.binaryP95Bytes, 32768);
  assert.equal(report.thresholds.serializationMsPerSnapshot, 2.5);
  assert.equal(report.decision, 'JSON_KEEP');
  const full20 = report.cases.find((entry) => entry.label === '20-player-full');
  assert.ok(full20);
  for (const field of ['averageBytes', 'p95Bytes', 'messagesPerSecond', 'serializationMs', 'serializationMsPerSnapshot']) {
    assert.ok(Number.isFinite(full20[field]), `missing metric ${field}`);
  }
  assert.ok(full20.p95Bytes < 32768);
  assert.ok(full20.serializationMsPerSnapshot < 2.5);
});

test('scale evidence documents interpolation, 20 Hz cap and no binary codec', async () => {
  const doc = await readFile('docs/performance/v1-scale-evidence.md', 'utf8');
  assert.ok(doc.includes('JSON_KEEP'));
  assert.ok(doc.includes('rig.position.lerp'));
  assert.ok(doc.includes('20 Hz'));
  assert.ok(doc.includes('9,926'));
});
