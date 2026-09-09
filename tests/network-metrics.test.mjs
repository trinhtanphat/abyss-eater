import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendBinary, summarizeNetworkSamples } from '../src/network-metrics.mjs';

test('network sample summary reports bounded byte/player/rate/serialization percentiles', () => {
  const summary = summarizeNetworkSamples([
    { bytes: 1000, players: 1, serializeMs: 0.1, at: 1000 },
    { bytes: 2000, players: 10, serializeMs: 0.2, at: 1050 },
    { bytes: 3000, players: 20, serializeMs: 0.3, at: 1100 },
    { bytes: 4000, players: 20, serializeMs: 0.4, at: 1150 },
  ]);
  assert.equal(summary.count, 4);
  assert.equal(summary.averageBytes, 2500);
  assert.equal(summary.p95Bytes, 4000);
  assert.equal(summary.averagePlayers, 12.75);
  assert.equal(summary.maxPlayers, 20);
  assert.equal(summary.messagesPerSecond, 20);
  assert.equal(summary.averageSerializeMs, 0.25);
  assert.equal(summary.p95SerializeMs, 0.4);
});

test('binary recommendation is evidence-gated by explicit JSON budgets', () => {
  const healthy = { p95Bytes: 12000, p95SerializeMs: 0.8, messagesPerSecond: 20 };
  assert.equal(recommendBinary(healthy).recommended, false);

  const oversized = { p95Bytes: 40000, p95SerializeMs: 0.8, messagesPerSecond: 20 };
  assert.equal(recommendBinary(oversized).recommended, true);
  assert.equal(recommendBinary(oversized).reason, 'snapshot_bytes');

  const expensive = { p95Bytes: 12000, p95SerializeMs: 3.5, messagesPerSecond: 20 };
  assert.equal(recommendBinary(expensive).recommended, true);
  assert.equal(recommendBinary(expensive).reason, 'serialization_cpu');
});
