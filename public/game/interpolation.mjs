export const REMOTE_INTERPOLATION_DELAY_MS = 100;
export const MAX_RENDER_ADVANCE_MS = 150;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function point(value = {}) {
  return { x: finite(value.x), y: finite(value.y), z: finite(value.z) };
}

function lerp(a, b, alpha) {
  return {
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    z: a.z + (b.z - a.z) * alpha,
  };
}

export function createInterpolationBuffer({ maxSamples = 4 } = {}) {
  const limit = Math.min(8, Math.max(2, Math.floor(Number(maxSamples) || 4)));
  const samples = [];
  function push(position, serverTime, receivedAt = 0) {
    const time = finite(serverTime);
    const sample = { position: point(position), serverTime: time, receivedAt: finite(receivedAt) };
    const existing = samples.findIndex((item) => item.serverTime === time);
    if (existing >= 0) samples[existing] = sample;
    else samples.push(sample);
    samples.sort((a, b) => a.serverTime - b.serverTime);
    while (samples.length > limit) samples.shift();
    return sample;
  }

  function sample(serverTime) {
    if (!samples.length) return null;
    const time = finite(serverTime);
    if (time <= samples[0].serverTime) return { ...samples[0].position };
    if (time >= samples.at(-1).serverTime) return { ...samples.at(-1).position };
    for (let index = 1; index < samples.length; index += 1) {
      const before = samples[index - 1];
      const after = samples[index];
      if (time > after.serverTime) continue;
      const span = Math.max(1, after.serverTime - before.serverTime);
      return lerp(before.position, after.position, (time - before.serverTime) / span);
    }
    return { ...samples.at(-1).position };
  }

  return { push, sample, clear: () => { samples.length = 0; }, get size() { return samples.length; }, get latest() { return samples.at(-1) || null; } };
}

export function renderServerTime({ latestServerTime = 0, latestReceivedAt = 0, now = 0, delayMs = REMOTE_INTERPOLATION_DELAY_MS } = {}) {
  const elapsed = Math.max(0, finite(now) - finite(latestReceivedAt));
  const advance = Math.min(MAX_RENDER_ADVANCE_MS, elapsed);
  const delay = Math.min(250, Math.max(50, finite(delayMs) || REMOTE_INTERPOLATION_DELAY_MS));
  return finite(latestServerTime) + advance - delay;
}

export function frameIndependentAlpha(ratePerSecond, deltaSeconds) {
  const rate = Math.min(60, Math.max(0, finite(ratePerSecond)));
  const delta = Math.min(0.1, Math.max(0, finite(deltaSeconds)));
  return 1 - Math.exp(-rate * delta);
}
