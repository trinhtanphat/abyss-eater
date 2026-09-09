export const NETWORK_BUDGETS = Object.freeze({
  p95SnapshotBytes: 32 * 1024,
  p95SerializeMs: 2,
  maxMessagesPerSecond: 20,
});

function networkFiniteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function networkNearestRank(values, ratio) {
  if (!values.length) return 0;
  const sorted = values.map(networkFiniteNonNegative).sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.min(sorted.length - 1, index)];
}

function networkAverage(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + networkFiniteNonNegative(value), 0) / values.length;
}
export function summarizeNetworkSamples(samples = []) {
  const rows = Array.isArray(samples) ? samples.filter((sample) => sample && typeof sample === 'object').slice(-512) : [];
  const bytes = rows.map((sample) => sample.bytes);
  const players = rows.map((sample) => sample.players);
  const serialize = rows.map((sample) => sample.serializeMs);
  const times = rows.map((sample) => networkFiniteNonNegative(sample.at)).sort((a, b) => a - b);
  const durationSeconds = times.length > 1 ? Math.max(0.001, (times.at(-1) - times[0]) / 1000) : 0;
  return {
    count: rows.length,
    averageBytes: networkAverage(bytes),
    p95Bytes: networkNearestRank(bytes, 0.95),
    averagePlayers: networkAverage(players),
    maxPlayers: players.length ? Math.max(...players.map(networkFiniteNonNegative)) : 0,
    messagesPerSecond: durationSeconds > 0 ? (rows.length - 1) / durationSeconds : 0,
    averageSerializeMs: networkAverage(serialize),
    p95SerializeMs: networkNearestRank(serialize, 0.95),
  };
}

export function recommendBinary(metrics = {}, budgets = NETWORK_BUDGETS) {
  if (networkFiniteNonNegative(metrics.p95Bytes) > budgets.p95SnapshotBytes) return { recommended: true, reason: 'snapshot_bytes' };
  if (networkFiniteNonNegative(metrics.p95SerializeMs) > budgets.p95SerializeMs) return { recommended: true, reason: 'serialization_cpu' };
  return { recommended: false, reason: 'json_within_budget' };
}

export function createSerializationMetrics({ maxSamples = 120, reportIntervalMs = 60_000 } = {}) {
  const capacity = Math.max(1, Math.min(512, Math.trunc(Number(maxSamples) || 120)));
  const interval = Math.max(10_000, Math.min(300_000, Number(reportIntervalMs) || 60_000));
  const samples = [];
  let lastReportAt = 0;

  function record(sample = {}) {
    const row = {
      bytes: networkFiniteNonNegative(sample.bytes),
      players: networkFiniteNonNegative(sample.players),
      serializeMs: networkFiniteNonNegative(sample.serializeMs),
      at: networkFiniteNonNegative(sample.at),
    };
    if (!lastReportAt && row.at > 0) lastReportAt = row.at;
    samples.push(row);
    if (samples.length > capacity) samples.splice(0, samples.length - capacity);
    return row;
  }

  function takeReport(now = Date.now()) {
    const current = networkFiniteNonNegative(now);
    if (!samples.length) return null;
    if (lastReportAt && current - lastReportAt < interval) return null;
    const report = summarizeNetworkSamples(samples);
    samples.length = 0;
    lastReportAt = current;
    return report;
  }

  return {
    record,
    takeReport,
    get size() { return samples.length; },
  };
}
