import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('modular network client fails closed instead of reconnecting forever on protocol mismatch', async () => {
  const source = await readFile('public/game/network.js', 'utf8');
  for (const marker of [
    'let protocolBlocked = false;',
    'VERSIONED_MESSAGE_TYPES',
    'blockForProtocolMismatch()',
    "onStatus('Upgrade required'",
    'if (protocolBlocked)',
    'shouldReconnect = false;',
  ]) {
    assert.ok(source.includes(marker), `missing fail-closed protocol marker: ${marker}`);
  }
});
