import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('client network fails closed instead of reconnecting forever on protocol mismatch', async () => {
  const source = await readFile('public/game/network.js', 'utf8');
  for (const marker of [
    'let protocolBlocked = false;',
    'VERSIONED_MESSAGE_TYPES',
    'blockForProtocolMismatch()',
    'shouldReconnect = false;',
    'if (protocolBlocked)',
    "socket.close(1002, 'protocol-version')",
  ]) {
    assert.ok(source.includes(marker), `missing fail-closed protocol marker: ${marker}`);
  }
});

test('resume storage stays keyed by the requested room label after canonical room allocation', async () => {
  const source = await readFile('public/game/network.js', 'utf8');
  assert.ok(source.includes('const resumeKey = readResumeKey(credentials.room);'));
  assert.ok(source.includes('writeResumeKey(credentials.room, message.resumeKey)'));
  assert.equal(source.includes('writeResumeKey(message.room'), false);
});
