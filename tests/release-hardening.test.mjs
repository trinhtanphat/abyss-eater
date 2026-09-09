import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const evidence = await import('../scripts/release-evidence.mjs').catch(() => ({}));
const probe = await import('../scripts/probe-live.mjs').catch(() => ({}));

test('release evidence records exact source and Worker hashes without credentials', async () => {
  assert.equal(typeof evidence.collectReleaseEvidence, 'function');
  const dir = await mkdtemp(path.join(tmpdir(), 'abyss-release-'));
  try {
    const worker = path.join(dir, 'worker.mjs');
    const index = path.join(dir, 'index.html');
    const sw = path.join(dir, 'sw.js');
    await writeFile(worker, 'export default {fetch(){}};');
    await writeFile(index, '<button id="quick-dive-button">Quick Dive</button>');
    await writeFile(sw, "const CACHE_NAME = 'abyss-eater-shell-v10';");
    const result = await evidence.collectReleaseEvidence({ workerPath: worker, indexPath: index, swPath: sw, sourceSha: 'a'.repeat(40) });
    assert.equal(result.sourceSha, 'a'.repeat(40));
    assert.match(result.workerSha256, /^[a-f0-9]{64}$/);
    assert.ok(result.workerBytes > 0);
    assert.equal(result.shell.quickDive, true);
    assert.equal(result.shell.cacheName, 'abyss-eater-shell-v10');
    assert.equal(JSON.stringify(result).includes('CLOUDFLARE_API_TOKEN'), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('probe helpers classify PASS FAIL NO_RESULT and redact sensitive query values', () => {
  assert.equal(typeof probe.classifyHttpResult, 'function');
  assert.equal(typeof probe.redactUrl, 'function');
  assert.equal(probe.classifyHttpResult({ status: 200 }), 'PASS');
  assert.equal(probe.classifyHttpResult({ status: 503 }), 'FAIL');
  assert.equal(probe.classifyHttpResult({ error: new Error('dns') }), 'NO_RESULT');
  const redacted = probe.redactUrl('wss://example.test/ws?session=secret-token&resume=abc&room=reef');
  assert.equal(redacted.includes('secret-token'), false);
  assert.equal(redacted.includes('resume=abc'), false);
  assert.ok(redacted.includes('room=reef'));
});

test('repository release scripts remain read-only with respect to Cloudflare', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = `${await readFile('scripts/release-evidence.mjs', 'utf8').catch(() => '')}\n${await readFile('scripts/probe-live.mjs', 'utf8').catch(() => '')}`;
  for (const forbidden of ['wrangler deploy', 'd1 migrations apply', 'CLOUDFLARE_API_TOKEN']) {
    assert.equal(source.includes(forbidden), false, `release qualification must be read-only: ${forbidden}`);
  }
});
