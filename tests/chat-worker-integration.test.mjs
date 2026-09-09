import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClientMessage } from '../src/protocol.mjs';
import { readFile } from 'node:fs/promises';

test('protocol v2 accepts only bounded string chat messages', () => {
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'chat', v: 2, text: 'hello reef' })), {
    ok: true,
    message: { type: 'chat', v: 2, text: 'hello reef' },
  });
  assert.equal(parseClientMessage(JSON.stringify({ type: 'chat', v: 2, text: 4 })).code, 'bad_chat');
  assert.equal(parseClientMessage(JSON.stringify({ type: 'chat', v: 2, text: 'x'.repeat(161) })).code, 'bad_chat');
});

test('GameRoom broadcasts accepted chat outside snapshots with separate chat state', async () => {
  const worker = await readFile('src/worker.template.mjs', 'utf8');
  for (const marker of ['/*__CHAT__*/', 'chatState', 'acceptChatMessage', 'broadcastChat', "type: 'chat'"]) {
    assert.ok(worker.includes(marker), `missing room chat marker: ${marker}`);
  }
  const snapshotStart = worker.indexOf('  snapshot(includeFood');
  const snapshotEnd = worker.indexOf('  broadcastSnapshot(', snapshotStart);
  assert.equal(worker.slice(snapshotStart, snapshotEnd).includes('chat'), false, 'chat must stay outside movement snapshots');
});
test('build embeds chat rules before protocol and generated Worker keeps protocol v2', async () => {
  const build = await readFile('scripts/build.mjs', 'utf8');
  assert.match(build, /src\/chat\.mjs/);
  assert.match(build, /\/\*__CHAT__\*\//);
  const chatIndex = build.indexOf("'/*__CHAT__*/'");
  const protocolIndex = build.indexOf("'/*__PROTOCOL__*/'");
  assert.ok(chatIndex >= 0 && chatIndex < protocolIndex, 'chat constants must be embedded before protocol');
});
