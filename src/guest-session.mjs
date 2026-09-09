const encoder = new TextEncoder();
const SESSION_VERSION = 1;
const SESSION_ID_RE = /^[a-f0-9]{64}$/;
const SIGNATURE_RE = /^[A-Za-z0-9_-]+$/;

function secretBytes(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new TypeError('session signing secret must be at least 32 characters');
  }
  return encoder.encode(secret);
}

async function importHmacKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    secretBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  );
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  if (!SIGNATURE_RE.test(value)) throw new TypeError('invalid base64url');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function newSessionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function signSessionCredential({ sessionId, expiresAt }, secret) {
  if (!SESSION_ID_RE.test(String(sessionId ?? ''))) throw new TypeError('invalid session id');
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) throw new TypeError('invalid expiry');
  const payload = `v${SESSION_VERSION}.${sessionId}.${expiresAt}`;
  const key = await importHmacKey(secret, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return `${payload}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionCredential(token, secret, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 255) return { ok: false, reason: 'invalid' };
    const parts = token.split('.');
    if (parts.length !== 4 || parts[0] !== `v${SESSION_VERSION}`) return { ok: false, reason: 'invalid' };
    const [, sessionId, expiryText, signatureText] = parts;
    const expiresAt = Number(expiryText);
    if (!SESSION_ID_RE.test(sessionId) || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
      return { ok: false, reason: 'invalid' };
    }
    const payload = `${parts[0]}.${sessionId}.${expiryText}`;
    const key = await importHmacKey(secret, ['verify']);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signatureText),
      encoder.encode(payload),
    );
    if (!valid) return { ok: false, reason: 'invalid' };
    if (!Number.isFinite(now) || now > expiresAt) return { ok: false, reason: 'expired' };
    return { ok: true, sessionId, expiresAt, version: SESSION_VERSION };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
