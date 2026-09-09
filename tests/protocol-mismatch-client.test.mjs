import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('client fails closed instead of reconnecting forever on protocol mismatch', async () => {
  const source = await readFile('public/app.js', 'utf8');
  for (const marker of [
    'let protocolBlocked = false;',
    'VERSIONED_MESSAGE_TYPES',
    'blockForProtocolMismatch()',
    "setStatus('Upgrade required')",
    'if (protocolBlocked)',
  ]) {
    assert.ok(source.includes(marker), `missing fail-closed protocol marker: ${marker}`);
  }
});

test('resume storage stays keyed by the requested room label after canonical room allocation', async () => {
  const source = await readFile('public/app.js', 'utf8');
  assert.ok(source.includes('const resumeKey = readResumeKey(room);'));
  assert.ok(source.includes('writeResumeKey(room, message.resumeKey);'));
  assert.equal(source.includes('writeResumeKey(message.room || room, message.resumeKey);'), false);
});
