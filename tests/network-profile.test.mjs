import test from 'node:test';
import assert from 'node:assert/strict';
import { profileRepresentativeNetwork } from '../scripts/profile-network.mjs';

test('representative network profile measures deterministic V1 room scales', () => {
  const report = profileRepresentativeNetwork({ iterations: 40 });
  assert.deepEqual(report.scenarios.map((row) => row.players), [1, 10, 20]);
  for (const row of report.scenarios) {
    assert.ok(row.full.averageBytes > row.delta.averageBytes);
    assert.ok(row.full.p95Bytes > 0);
    assert.ok(row.delta.p95Bytes > 0);
    assert.ok(Number.isFinite(row.full.p95SerializeMs));
    assert.ok(row.messagesPerSecond <= 20);
  }
  assert.equal(typeof report.binary.recommended, 'boolean');
  assert.equal(typeof report.binary.reason, 'string');
  assert.equal(report.budgets.p95SnapshotBytes, 32768);
});
