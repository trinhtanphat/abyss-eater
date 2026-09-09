import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSerializationMetrics } from '../src/network-metrics.mjs';

test('serialization metrics stay bounded and report only on coarse interval', () => {
  const metrics = createSerializationMetrics({ maxSamples: 3, reportIntervalMs: 60_000 });
  metrics.record({ bytes: 100, players: 1, serializeMs: 0.1, at: 1_000 });
  metrics.record({ bytes: 200, players: 2, serializeMs: 0.2, at: 2_000 });
  metrics.record({ bytes: 300, players: 3, serializeMs: 0.3, at: 3_000 });
  metrics.record({ bytes: 400, players: 4, serializeMs: 0.4, at: 4_000 });
  assert.equal(metrics.size, 3);
  assert.equal(metrics.takeReport(59_999), null);
  const report = metrics.takeReport(61_000);
  assert.equal(report.count, 3);
  assert.equal(report.maxPlayers, 4);
  assert.equal(report.p95Bytes, 400);
  assert.equal(metrics.takeReport(70_000), null);
});

test('hidden tabs skip routine input and ping without disconnecting the socket', async () => {
  const app = await readFile('public/app.js', 'utf8');
  assert.ok(app.includes('function sendRoutineInput()'));
  assert.ok(app.includes('if (!started || document.hidden) return false;'));
  assert.ok(app.includes('function sendRoutinePing()'));
  assert.ok(app.includes("document.addEventListener('visibilitychange'"));
  assert.ok(app.includes('network.sendInput(input.direction(), input.boosting())'));
  assert.ok(app.includes('network.ping()'));
  assert.equal(app.includes('network.disconnect'), false, 'visibility handling must not disconnect realtime');
});

test('Worker instruments snapshot serialization privately without persistence or public debug API', async () => {
  const [worker, build] = await Promise.all([
    readFile('src/worker.template.mjs', 'utf8'),
    readFile('scripts/build.mjs', 'utf8'),
  ]);
  assert.ok(worker.includes('createSerializationMetrics'));
  assert.ok(worker.includes("event: 'snapshot_metrics'"));
  assert.ok(worker.includes('this.serializationMetrics.record'));
  assert.ok(worker.includes('this.serializationMetrics.takeReport'));
  assert.ok(build.includes("readFile('src/network-metrics.mjs'"));
  assert.ok(build.includes("'/*__NETWORK_METRICS__*/'"));
  assert.equal(/\/api\/(metrics|debug|network-profile)/.test(worker), false);
  assert.equal(/serializationMetrics[^\n]*storage\.(put|set)/.test(worker), false);
  for (const forbidden of ['sessionToken', 'resumeKey', 'chat', 'displayName']) {
    assert.equal(worker.includes(`snapshot_metrics', ${forbidden}`), false);
  }
});
