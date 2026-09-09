import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('Worker exposes fail-closed opaque-session persistence APIs', () => {
  const worker = readFileSync('src/worker.template.mjs', 'utf8');
  for (const marker of [
    "url.pathname === '/api/session/guest'",
    "url.pathname === '/api/profile'",
    "url.pathname === '/api/skins'",
    "url.pathname === '/api/skins/buy'",
    "url.pathname === '/api/skins/select'",
    "url.pathname === '/api/leaderboard'",
    'PROFILE_DB',
    'SESSION_SIGNING_KEY',
    'Authorization',
    'Bearer ',
    'newSessionId',
    'createSession',
    'profileForSession',
    "error: 'persistence_unavailable'",
    "code: 'unauthorized'",
  ]) assert.ok(worker.includes(marker), `Worker API must include ${marker}`);
  assert.ok(worker.indexOf("url.pathname === '/api/profile'") < worker.indexOf("url.pathname === '/ws'"));
  assert.equal(/signSession\(\{\s*profileId:/.test(worker), false, 'signed token must not contain profileId');
});
test('production build embeds opaque-session persistence modules without changing protocol v2', () => {
  const build = readFileSync('scripts/build.mjs', 'utf8');
  for (const marker of [
    "readFile('src/progression.mjs'",
    "readFile('src/session-token.mjs'",
    "readFile('src/profile-store.mjs'",
    "'/*__PROGRESSION__*/'",
    "'/*__SESSION_TOKEN__*/'",
    "'/*__PROFILE_STORE__*/'",
  ]) assert.ok(build.includes(marker), `build must include ${marker}`);
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, `build must succeed:\n${result.stdout}\n${result.stderr}`);
  const bundle = readFileSync('dist/worker.mjs', 'utf8');
  assert.ok(bundle.includes('const PROTOCOL_VERSION = 2;'));
  assert.ok(bundle.includes("url.pathname === '/api/session/guest'"));
  assert.ok(bundle.includes("url.pathname === '/api/profile'"));
  assert.equal(bundle.includes('/*__PROFILE_STORE__*/'), false);
});
