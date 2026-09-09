export const RECONNECT_GRACE_MS = 12000;

function opaqueRandomHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function constantShapeEqual(left, right) {
  const a = String(left ?? '');
  const b = String(right ?? '');
  const length = Math.max(a.length, b.length, 1);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i % Math.max(a.length, 1)) || 0)
      ^ (b.charCodeAt(i % Math.max(b.length, 1)) || 0);
  }
  return diff === 0;
}

export function makeResumeKey() {
  const uuid = crypto.randomUUID().replace(/-/g, '');
  return `${uuid}${opaqueRandomHex(16)}`;
}

export function makeReconnectSlot(player, resumeKey, disconnectedAt) {
  return {
    ...player,
    position: {
      x: Number.isFinite(player?.position?.x) ? player.position.x : 0,
      y: Number.isFinite(player?.position?.y) ? player.position.y : 0,
      z: Number.isFinite(player?.position?.z) ? player.position.z : 0,
    },
    resumeKey: String(resumeKey ?? ''),
    disconnectedAt: Number.isFinite(disconnectedAt) ? disconnectedAt : 0,
    interactive: false,
  };
}

export function isReconnectSlotExpired(slot, now, graceMs = RECONNECT_GRACE_MS) {
  if (!slot || !Number.isFinite(slot.disconnectedAt) || !Number.isFinite(now)) return true;
  if (!Number.isFinite(graceMs) || graceMs <= 0) return true;
  if (now < slot.disconnectedAt) return true;
  return now - slot.disconnectedAt >= graceMs;
}

export function canResume(slot, resumeKey, now) {
  const supplied = String(resumeKey ?? '');
  if (!slot || supplied.length === 0 || String(slot.resumeKey ?? '').length === 0) return false;
  if (isReconnectSlotExpired(slot, now)) return false;
  return constantShapeEqual(slot.resumeKey, supplied);
}

export function makeRateState() {
  return { startedAt: 0, count: 0 };
}