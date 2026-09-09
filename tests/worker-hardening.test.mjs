import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function builtWorker() {
  await execFileAsync(process.execPath, ['scripts/build.mjs']);
  return readFile('dist/worker.mjs', 'utf8');
}

test('production Worker enforces versioned rate-limited authoritative input', async () => {
  const source = await builtWorker();
  for (const marker of [
    'const INPUT_RATE_LIMIT = 25;',
    'const INPUT_RATE_WINDOW_MS = 1000;',
    "code: 'rate_limited'",
    "code: 'bad_seq'",
    'parseClientMessage(rawMessage)',
    'acceptSequence(player.seq, message.seq)',
    'protocolVersion: PROTOCOL_VERSION',
    'v: PROTOCOL_VERSION',
  ]) {
    assert.ok(source.includes(marker), `missing Worker hardening marker: ${marker}`);
  }
  assert.equal(
    source.includes('const seq = Number.isSafeInteger(message.seq) ? message.seq : player.seq + 1;'),
    false,
    'server must never invent a client sequence number',
  );
});

test('production Worker uses bounded spatial collision candidates', async () => {
  const source = await builtWorker();
  for (const marker of [
    'const COLLISION_CELL_SIZE = 8;',
    'buildSpatialBuckets(',
    'nearbyFromBuckets(',
    'resolveEatPair(player, other)',
    '.sort((a, b) => String(a.player.id).localeCompare(String(b.player.id)))',
  ]) {
    assert.ok(source.includes(marker), `missing spatial collision marker: ${marker}`);
  }
});

test('production Worker supports bounded resumable presence without a perpetual server timer', async () => {
  const source = await builtWorker();
  const serverTemplate = await readFile('src/worker.template.mjs', 'utf8');
  for (const marker of [
    "const RECONNECT_INDEX_KEY = 'reconnect:index';",
    "`reconnect:${resumeKey}`",
    'makeReconnectSlot(',
    'canResume(',
    'resumeKey',
    'resumed',
    'interactive: true',
    'async webSocketClose(ws)',
    'async webSocketError(ws)',
  ]) {
    assert.ok(source.includes(marker), `missing reconnect marker: ${marker}`);
  }
  assert.equal(serverTemplate.includes('setInterval('), false, 'Durable Object server must not run a perpetual interval');
  assert.equal(serverTemplate.includes('setTimeout('), false, 'Durable Object server must not run a perpetual timeout');
});

test('all gameplay WebSocket messages are protocol-versioned', async () => {
  const source = await builtWorker();
  for (const type of ['welcome', 'snapshot', 'pong', 'eaten', 'error']) {
    const pattern = new RegExp(`type:\\s*['\"]${type}['\"][\\s\\S]{0,180}v:\\s*PROTOCOL_VERSION`);
    assert.match(source, pattern, `${type} message must carry protocol version`);
  }
  assert.ok(source.includes("const VERSION = '0.2.0';"));
});