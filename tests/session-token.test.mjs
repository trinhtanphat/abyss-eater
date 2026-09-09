import test from 'node:test';
import assert from 'node:assert/strict';

const sessions = await import('../src/session-token.mjs').catch(() => ({}));

function requireExport(name) {
  assert.equal(typeof sessions[name], 'function', `${name} must be implemented`);
  return sessions[name];
}

test('signed guest session round-trips only identity metadata', async () => {
  const signSession = requireExport('signSession');
  const verifySession = requireExport('verifySession');
  const now = 1_800_000_000_000;
  const payload = { profileId: 'profile-123', version: 1, expiresAt: now + 60_000 };
  const token = await signSession(payload, 'test-secret-abcdefghijklmnopqrstuvwxyz', now);
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(token.includes('pearls'), false);
  assert.equal(token.includes('score'), false);
  assert.deepEqual(await verifySession(token, 'test-secret-abcdefghijklmnopqrstuvwxyz', now + 1), payload);
});

test('session verification rejects expiry, tampering, bad secret and malformed tokens', async () => {
  const signSession = requireExport('signSession');
  const verifySession = requireExport('verifySession');
  const now = 1_800_000_000_000;
  const payload = { profileId: 'profile-123', version: 2, expiresAt: now + 10_000 };
  const token = await signSession(payload, 'test-secret-abcdefghijklmnopqrstuvwxyz', now);
  const [body, signature] = token.split('.');
  const tampered = `${body.slice(0, -1)}${body.endsWith('A') ? 'B' : 'A'}.${signature}`;
  assert.equal(await verifySession(token, 'test-secret-abcdefghijklmnopqrstuvwxyz', now + 10_001), null);
  assert.equal(await verifySession(tampered, 'test-secret-abcdefghijklmnopqrstuvwxyz', now + 1), null);
  assert.equal(await verifySession(token, 'different-test-secret-abcdefghijklmnop', now + 1), null);
  assert.equal(await verifySession('not-a-token', 'test-secret-abcdefghijklmnopqrstuvwxyz', now), null);
  assert.equal(await verifySession('', 'test-secret-abcdefghijklmnopqrstuvwxyz', now), null);
});

test('signSession rejects invalid identity payloads and weak/missing secrets', async () => {
  const signSession = requireExport('signSession');
  const now = 1_800_000_000_000;
  await assert.rejects(() => signSession({ profileId: '', version: 1, expiresAt: now + 1000 }, 'test-secret-abcdefghijklmnopqrstuvwxyz', now));
  await assert.rejects(() => signSession({ profileId: 'p', version: 0, expiresAt: now + 1000 }, 'test-secret-abcdefghijklmnopqrstuvwxyz', now));
  await assert.rejects(() => signSession({ profileId: 'p', version: 1, expiresAt: now }, 'test-secret-abcdefghijklmnopqrstuvwxyz', now));
  await assert.rejects(() => signSession({ profileId: 'p', version: 1, expiresAt: now + 1000 }, 'short', now));
});
