import test from 'node:test';
import assert from 'node:assert/strict';

const metrics = await import('../src/snapshot-metrics.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof metrics[name], 'function', `${name} must be implemented`);
  return metrics[name];
}

test('measureSnapshot reports UTF-8 bytes and entity counts', () => {
  const measureSnapshot = requireFn('measureSnapshot');
  const value = { type: 'snapshot', players: [{ id: 'p1' }], wildlife: [{ id: 'w1' }], food: [{ id: 'f1' }] };
  const result = measureSnapshot(value);
  assert.equal(result.bytes, Buffer.byteLength(JSON.stringify(value)));
  assert.deepEqual({ players: result.players, wildlife: result.wildlife, food: result.food }, { players: 1, wildlife: 1, food: 1 });
});

test('percentile is deterministic and clamps percentile input', () => {
  const percentile = requireFn('percentile');
  assert.equal(percentile([5, 1, 9, 3], 0.95), 9);
  assert.equal(percentile([5, 1, 9, 3], 0), 1);
  assert.equal(percentile([5, 1, 9, 3], 2), 9);
  assert.equal(percentile([], 0.95), 0);
});

test('summarizeSamples handles empty and populated samples safely', () => {
  const summarizeSamples = requireFn('summarizeSamples');
  assert.deepEqual(summarizeSamples([], 0), {
    count: 0, averageBytes: 0, p95Bytes: 0, messagesPerSecond: 0, serializationMs: 0,
  });
  const result = summarizeSamples([{ bytes: 100 }, { bytes: 200 }, { bytes: 300 }], 60);
  assert.equal(result.count, 3);
  assert.equal(result.averageBytes, 200);
  assert.equal(result.p95Bytes, 300);
  assert.equal(result.messagesPerSecond, 50);
  assert.equal(result.serializationMs, 60);
});
