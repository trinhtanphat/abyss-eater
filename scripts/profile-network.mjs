import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { NETWORK_BUDGETS, recommendBinary, summarizeNetworkSamples } from '../src/network-metrics.mjs';

const FOOD_COUNT = 42;
const WILDLIFE_COUNT = 24;
const HAZARD_COUNT = 8;
const PICKUP_COUNT = 12;
const SNAPSHOT_HZ = 20;

function position(index, scale = 1) {
  return {
    x: Number((((index * 17) % 137) - 68) * scale).toFixed(3),
    y: Number((((index * 7) % 47) - 23) * scale).toFixed(3),
    z: Number((((index * 29) % 137) - 68) * scale).toFixed(3),
  };
}

function player(index) {
  return {
    id: `p-${String(index).padStart(2, '0')}`,
    name: `Fish ${index}`,
    position: position(index, 0.8),
    mass: Number((1 + index * 0.37).toFixed(3)),
    score: index * 125,
    deaths: index % 3,
    skinId: index % 2 ? 'reef' : 'sunset',
    biome: index % 2 ? 'reef' : 'deep',
  };
}
function fullSnapshot(players) {
  return {
    type: 'snapshot', v: 2, seq: 1, serverTime: 1_789_000_000_000,
    players: Array.from({ length: players }, (_, index) => player(index)),
    food: Array.from({ length: FOOD_COUNT }, (_, index) => ({ id: `f-${index}`, position: position(index + 50), value: 0.2 })),
    wildlife: Array.from({ length: WILDLIFE_COUNT }, (_, index) => ({
      id: `w-${index}`, kind: 'wildlife', name: `Wild ${index}`, position: position(index + 100, 0.9),
      mass: Number((0.55 + index * 0.31).toFixed(3)), behavior: index % 4 === 0 ? 'hunt' : 'school', aiState: 'wander', biome: 'reef',
    })),
    hazards: Array.from({ length: HAZARD_COUNT }, (_, index) => ({ id: `h-${index}`, kind: 'hazard', type: 'jelly', position: position(index + 150), radius: 2.5, value: 0, biome: 'deep' })),
    pickups: Array.from({ length: PICKUP_COUNT }, (_, index) => ({ id: `u-${index}`, kind: 'pickup', type: index % 2 ? 'pearl' : 'current', position: position(index + 180), radius: 1.1, value: index % 2 ? 3 : 0, biome: 'reef' })),
  };
}

function deltaSnapshot(players) {
  const snapshot = fullSnapshot(players);
  return { type: snapshot.type, v: snapshot.v, seq: 2, serverTime: snapshot.serverTime + 50, players: snapshot.players };
}

function measureSnapshot(snapshot, iterations) {
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    const payload = JSON.stringify(snapshot);
    const serializeMs = performance.now() - started;
    samples.push({ bytes: Buffer.byteLength(payload), players: snapshot.players.length, serializeMs, at: index * (1000 / SNAPSHOT_HZ) });
  }
  return summarizeNetworkSamples(samples);
}
export function profileRepresentativeNetwork({ iterations = 200 } = {}) {
  const count = Math.min(2000, Math.max(20, Math.floor(Number(iterations) || 200)));
  const scenarios = [1, 10, 20].map((players) => {
    const full = measureSnapshot(fullSnapshot(players), count);
    const delta = measureSnapshot(deltaSnapshot(players), count);
    return { players, messagesPerSecond: SNAPSHOT_HZ, full, delta };
  });
  const worst = scenarios.at(-1).full;
  return {
    protocol: 2,
    format: 'json',
    roomCap: 20,
    scenarios,
    budgets: NETWORK_BUDGETS,
    binary: recommendBinary(worst),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = profileRepresentativeNetwork();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
