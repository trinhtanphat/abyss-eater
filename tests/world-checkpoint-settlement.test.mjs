import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('src/worker.template.mjs', 'utf8');

test('checkpoint settlement credits pearl pickups only as an incremental server-owned delta', () => {
  assert.ok(worker.includes('const bonusPearlsDelta = Math.max(0, player.bonusPearls - player.checkpointBonusPearls);'));
  assert.ok(worker.includes('bonusPearls: bonusPearlsDelta'));
  assert.ok(worker.includes('checkpointBonusPearls: player.bonusPearls'));
  assert.ok(worker.includes('checkpointBonusPearls: 0'));
  assert.ok(worker.includes('bonusPearlsDelta <= 0'));
});