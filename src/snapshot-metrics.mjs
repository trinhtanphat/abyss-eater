function metricCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

export function measureSnapshot(value) {
  const json = JSON.stringify(value ?? null);
  return {
    bytes: Buffer.byteLength(json, 'utf8'),
    players: metricCount(value?.players),
    wildlife: metricCount(value?.wildlife),
    food: metricCount(value?.food),
    hazards: metricCount(value?.hazards),
    pickups: metricCount(value?.pickups),
  };
}

export function percentile(values, p = 0.95) {
  const sorted = (Array.isArray(values) ? values : [])
    .map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const q = Math.max(0, Math.min(1, Number.isFinite(Number(p)) ? Number(p) : 0.95));
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] ?? sorted[0];
}

export function summarizeSamples(samples, durationMs = 0) {
  const list = Array.isArray(samples) ? samples.filter((sample) => Number.isFinite(Number(sample?.bytes))) : [];
  if (!list.length) {
    return { count: 0, averageBytes: 0, p95Bytes: 0, messagesPerSecond: 0, serializationMs: 0 };
  }
  const bytes = list.map((sample) => Number(sample.bytes));
  const elapsed = Math.max(0, Number(durationMs) || 0);
  return {
    count: list.length,
    averageBytes: Math.round(bytes.reduce((sum, value) => sum + value, 0) / list.length),
    p95Bytes: percentile(bytes, 0.95),
    messagesPerSecond: elapsed > 0 ? Number(((list.length * 1000) / elapsed).toFixed(2)) : 0,
    serializationMs: Number(elapsed.toFixed(3)),
  };
}
