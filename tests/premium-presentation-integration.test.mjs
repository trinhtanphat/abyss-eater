import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const presentation = await import('../public/game/presentation.js').catch(() => ({}));
const config = await import('../public/game/config.js').catch(() => ({}));

test('premium presentation uses the existing auto/high/medium/low quality contract', () => {
  assert.equal(presentation.normalizeQuality?.('medium'), 'medium');
  assert.equal(presentation.normalizeQuality?.('balanced'), 'auto');
  assert.ok(config.QUALITY_PROFILES?.medium, 'medium profile must exist');
  assert.equal(config.QUALITY_PROFILES?.balanced, undefined, 'balanced must remain a display label, not a second persisted value');
});

test('premium networking stays protocol v2 and room-label resume scoped', async () => {
  const network = await readFile('public/game/network.js', 'utf8');
  assert.ok(network.includes('const PROTOCOL_VERSION = 2;'));
  assert.ok(network.includes('writeResumeKey(credentials.room, message.resumeKey)'));
  assert.ok(network.includes("socket.close(1002, 'protocol-version')"));
});

test('premium client state preserves food across player-only v2 snapshots', async () => {
  const state = await readFile('public/game/state.js', 'utf8');
  assert.ok(state.includes('Array.isArray(next.food) ? next.food : snapshot.food'));
});
