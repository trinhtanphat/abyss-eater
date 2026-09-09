const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid-base64url');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function validateSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 16) throw new Error('session-secret-invalid');
  return secret;
}

function canonicalPayload(payload, nowMs) {
  const profileId = typeof payload?.profileId === 'string' ? payload.profileId.trim() : '';
  const version = Number(payload?.version);
  const expiresAt = Number(payload?.expiresAt);
  const now = Number(nowMs);
  if (!profileId || profileId.length > 128) throw new Error('session-profile-invalid');
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('session-version-invalid');
  if (!Number.isSafeInteger(expiresAt) || !Number.isFinite(now) || expiresAt <= now) throw new Error('session-expiry-invalid');
  return { profileId, version, expiresAt };
}

async function importHmacKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(validateSecret(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  );
}

export async function signSession(payload, secret, nowMs = Date.now()) {
  const canonical = canonicalPayload(payload, nowMs);
  const bodyBytes = encoder.encode(JSON.stringify(canonical));
  const key = await importHmacKey(secret, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, bodyBytes));
  return `${toBase64Url(bodyBytes)}.${toBase64Url(signature)}`;
}

export async function verifySession(token, secret, nowMs = Date.now()) {
  try {
    validateSecret(secret);
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const bodyBytes = fromBase64Url(parts[0]);
    const signatureBytes = fromBase64Url(parts[1]);
    const payload = canonicalPayload(JSON.parse(decoder.decode(bodyBytes)), nowMs);
    const key = await importHmacKey(secret, ['verify']);
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, bodyBytes);
    return valid ? payload : null;
  } catch {
    return null;
  }
}
