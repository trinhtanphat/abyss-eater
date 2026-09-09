export const PROTOCOL_VERSION = 2;
export const MAX_CLIENT_MESSAGE_LENGTH = 1024;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseClientMessage(rawMessage) {
  if (typeof rawMessage !== 'string' || rawMessage.length > MAX_CLIENT_MESSAGE_LENGTH) {
    return { ok: false, code: 'bad_message' };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return { ok: false, code: 'bad_json' };
  }

  if (!isPlainObject(parsed)) return { ok: false, code: 'bad_message' };
  if (parsed.v !== PROTOCOL_VERSION) return { ok: false, code: 'bad_version' };

  if (parsed.type === 'input') {
    if (!Number.isSafeInteger(parsed.seq) || parsed.seq < 0) {
      return { ok: false, code: 'bad_seq' };
    }
    if (!isPlainObject(parsed.dir)
      || !finiteNumber(parsed.dir.x)
      || !finiteNumber(parsed.dir.y)
      || !finiteNumber(parsed.dir.z)) {
      return { ok: false, code: 'bad_dir' };
    }
    return {
      ok: true,
      message: {
        type: 'input',
        v: PROTOCOL_VERSION,
        seq: parsed.seq,
        dir: { x: parsed.dir.x, y: parsed.dir.y, z: parsed.dir.z },
      },
    };
  }

  if (parsed.type === 'ping') {
    if (!finiteNumber(parsed.t)) return { ok: false, code: 'bad_ping' };
    return { ok: true, message: { type: 'ping', v: PROTOCOL_VERSION, t: parsed.t } };
  }

  return { ok: false, code: 'bad_type' };
}

export function acceptSequence(lastSeq, nextSeq) {
  return Number.isSafeInteger(lastSeq)
    && Number.isSafeInteger(nextSeq)
    && nextSeq >= 0
    && nextSeq > lastSeq;
}

export function consumeRateWindow(state, now, limit, windowMs) {
  const safeNow = Number.isFinite(now) ? now : 0;
  const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? limit : 1;
  const safeWindowMs = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 1000;
  const current = state ?? { startedAt: safeNow, count: 0 };
  const reset = !Number.isFinite(current.startedAt)
    || !Number.isSafeInteger(current.count)
    || current.count < 0
    || safeNow < current.startedAt
    || safeNow - current.startedAt >= safeWindowMs;
  const next = reset
    ? { startedAt: safeNow, count: 1 }
    : { startedAt: current.startedAt, count: current.count + 1 };
  return { allowed: next.count <= safeLimit, state: next };
}
