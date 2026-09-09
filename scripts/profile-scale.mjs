import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { measureSnapshot, summarizeSamples } from '../src/snapshot-metrics.mjs';

const ITERATIONS = 2000;
const SNAPSHOT_HZ_CAP = 20;
const BINARY_P95_TRIGGER_BYTES = 32 * 1024;
const SERIALIZATION_TRIGGER_MS = 2.5;

function position(seed) {
  return { x: (seed * 13) % 80 - 40, y: (seed * 7) % 28 - 14, z: (seed * 17) % 80 - 40 };
}

function player(i) {
  return { id: `player-${i}`, name: `Fish ${i}`, skinId: i % 2 ? 'reef' : 'azure', position: position(i), mass: 1 + i * 0.35, score: i * 125, deaths: i % 3 };
}

function wildlife(i) {
  return { id: `wild-${i}`, name: `Wild ${i}`, role: i === 23 ? 'apex' : i % 3 ? 'school' : 'predator', state: 'wander', biome: i % 2 ? 'reef' : 'deep-ocean', position: position(i + 40), mass: 0.4 + (i % 8) * 0.6 };
}

function fullSnapshot(playerCount) {
  return {
    type: 'snapshot', v: 2, seq: 42, serverTime: 1_787_000_000_000,
    players: Array.from({ length: playerCount }, (_, i) => player(i + 1)),
    wildlife: Array.from({ length: 24 }, (_, i) => wildlife(i + 1)),
    food: Array.from({ length: 48 }, (_, i) => ({ id: `food-${i}`, position: position(i + 90), value: 0.2 })),
    hazards: Array.from({ length: 6 }, (_, i) => ({ id: `hazard-${i}`, type: 'jelly', position: position(i + 160), radius: 1.4 })),
    pickups: Array.from({ length: 8 }, (_, i) => ({ id: `pickup-${i}`, type: i % 2 ? 'pearl' : 'boost', position: position(i + 180) })),
  };
}

function deltaSnapshot(playerCount) {
  const value = fullSnapshot(playerCount);
  return { type: value.type, v: value.v, seq: value.seq, serverTime: value.serverTime, players: value.players };
}

function profileCase(label, snapshot) {
  const samples = [];
  const started = performance.now();
  for (let i = 0; i < ITERATIONS; i += 1) {
    const json = JSON.stringify(snapshot);
    samples.push({ ...measureSnapshot(snapshot), bytes: Buffer.byteLength(json, 'utf8') });
  }
  const elapsedMs = performance.now() - started;
  const summary = summarizeSamples(samples, elapsedMs);
  return { label, ...summary, serializationMsPerSnapshot: Number((elapsedMs / ITERATIONS).toFixed(6)), estimatedMessagesPerSecond: SNAPSHOT_HZ_CAP };
}

const cases = [];
for (const count of [1, 10, 20]) {
  cases.push(profileCase(`${count}-player-full`, fullSnapshot(count)));
  cases.push(profileCase(`${count}-player-delta`, deltaSnapshot(count)));
}
const full20 = cases.find((entry) => entry.label === '20-player-full');
const decision = full20.p95Bytes > BINARY_P95_TRIGGER_BYTES || full20.serializationMsPerSnapshot > SERIALIZATION_TRIGGER_MS
  ? 'BINARY_EVALUATE'
  : 'JSON_KEEP';
const report = {
  generatedBy: 'npm run profile:scale', iterationsPerCase: ITERATIONS, snapshotHzCap: SNAPSHOT_HZ_CAP,
  thresholds: { binaryP95Bytes: BINARY_P95_TRIGGER_BYTES, serializationMsPerSnapshot: SERIALIZATION_TRIGGER_MS },
  decision, cases,
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/carrier6-scale-profile.json', `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
