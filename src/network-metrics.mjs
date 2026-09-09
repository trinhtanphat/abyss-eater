export const NETWORK_BUDGETS = Object.freeze({
  p95SnapshotBytes: 32 * 1024,
  p95SerializeMs: 2,
  maxMessagesPerSecond: 20,
});

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function nearestRank(values, ratio) {
  if (!values.length) return 0;
  const sorted = values.map(finiteNonNegative).sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.min(sorted.length - 1, index)];
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + finiteNonNegative(value), 0) / values.length;
}
export function summarizeNetworkSamples(samples = []) {
  const rows = Array.isArray(samples) ? samples.filter((sample) => sample && typeof sample === 'object').slice(-512) : [];
  const bytes = rows.map((sample) => sample.bytes);
  const players = rows.map((sample) => sample.players);
  const serialize = rows.map((sample) => sample.serializeMs);
  const times = rows.map((sample) => finiteNonNegative(sample.at)).sort((a, b) => a - b);
  const durationSeconds = times.length > 1 ? Math.max(0.001, (times.at(-1) - times[0]) / 1000) : 0;
  return {
    count: rows.length,
    averageBytes: average(bytes),
    p95Bytes: nearestRank(bytes, 0.95),
    averagePlayers: average(players),
    maxPlayers: players.length ? Math.max(...players.map(finiteNonNegative)) : 0,
    messagesPerSecond: durationSeconds > 0 ? (rows.length - 1) / durationSeconds : 0,
    averageSerializeMs: average(serialize),
    p95SerializeMs: nearestRank(serialize, 0.95),
  };
}

export function recommendBinary(metrics = {}, budgets = NETWORK_BUDGETS) {
  if (finiteNonNegative(metrics.p95Bytes) > budgets.p95SnapshotBytes) return { recommended: true, reason: 'snapshot_bytes' };
  if (finiteNonNegative(metrics.p95SerializeMs) > budgets.p95SerializeMs) return { recommended: true, reason: 'serialization_cpu' };
  return { recommended: false, reason: 'json_within_budget' };
}
