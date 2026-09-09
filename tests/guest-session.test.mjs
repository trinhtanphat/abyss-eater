import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newSessionId,
  signSessionCredential,
  verifySessionCredential,
} from '../src/guest-session.mjs';

const SECRET = 'test-secret-that-is-at-least-thirty-two-bytes-long';

test('newSessionId returns distinct 32-byte hex identifiers', () => {
  const first = newSessionId();
  const second = newSessionId();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.match(second, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
});

test('signed guest credential round-trips without profile authority fields', async () => {
  const sessionId = newSessionId();
  const expiresAt = 2_000_000;
  const token = await signSessionCredential({ sessionId, expiresAt }, SECRET);
  assert.ok(token.length < 256);
  assert.equal(token.includes('profile'), false);
  assert.equal(token.includes('balance'), false);
  assert.deepEqual(await verifySessionCredential(token, SECRET, 1_000_000), {
    ok: true, sessionId, expiresAt, version: 1,
  });
});

test('credential verification rejects expiry, tampering and wrong secrets', async () => {
  const sessionId = newSessionId();
  const token = await signSessionCredential({ sessionId, expiresAt: 20_000 }, SECRET);
  assert.deepEqual(await verifySessionCredential(token, SECRET, 20_001), {
    ok: false, reason: 'expired',
  });

  const tampered = token.replace(sessionId.slice(0, 8), 'ffffffff');
  assert.deepEqual(await verifySessionCredential(tampered, SECRET, 10_000), {
    ok: false, reason: 'invalid',
  });
  assert.deepEqual(
    await verifySessionCredential(token, 'different-secret-that-is-also-long-enough-12345', 10_000),
    { ok: false, reason: 'invalid' },
  );
});

test('credential verification rejects malformed input without throwing', async () => {
  assert.deepEqual(await verifySessionCredential('bad', SECRET, 0), {
    ok: false, reason: 'invalid',
  });
});
