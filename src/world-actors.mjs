import { radiusForMass } from './game-logic.mjs';
import { BIOME_IDS, biomeProfile, spawnPointInBiome } from './world.mjs';

export const HAZARD_COUNT = 8;
export const PICKUP_COUNT = 12;
export const HAZARD_SLOW_MS = 2000;
export const PICKUP_SPEED_MS = 4000;

function actorFinite(value) {
  return Number.isFinite(value) ? value : 0;
}

function actorClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function actorDistance3(a, b) {
  return Math.hypot(
    actorFinite(a?.x) - actorFinite(b?.x),
    actorFinite(a?.y) - actorFinite(b?.y),
    actorFinite(a?.z) - actorFinite(b?.z),
  );
}

function contacts(player, actor) {
  if (!player?.position || !actor?.position) return false;
  const radius = actorClamp(actorFinite(actor.radius), 0.2, 4);
  return actorDistance3(player.position, actor.position) <= radiusForMass(player.mass) + radius;
}

function weightedBiome(random, key) {
  const rng = typeof random === 'function' ? random : Math.random;
  const weights = BIOME_IDS.map((id) => Math.max(0.05, actorFinite(biomeProfile(id)?.[key])));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let sample = actorClamp(Number(rng()) || 0, 0, 0.999999) * total;
  for (let index = 0; index < BIOME_IDS.length; index += 1) {
    sample -= weights[index];
    if (sample < 0) return BIOME_IDS[index];
  }
  return 'reef';
}

export function makeWorldActors(bounds, idFactory, random = Math.random) {
  const makeId = typeof idFactory === 'function' ? idFactory : (() => {
    let id = 0;
    return () => `world-${++id}`;
  })();
  const rng = typeof random === 'function' ? random : Math.random;
  const hazards = Array.from({ length: HAZARD_COUNT }, () => {
    const biome = weightedBiome(rng, 'risk');
    return {
      id: String(makeId()),
      kind: 'hazard',
      type: 'jelly',
      radius: 1.4,
      biome,
      position: spawnPointInBiome(biome, bounds, rng),
    };
  });
  const pickups = Array.from({ length: PICKUP_COUNT }, (_, index) => {
    const biome = weightedBiome(rng, 'pickupWeight');
    const type = index % 2 === 0 ? 'current' : 'pearl';
    return {
      id: String(makeId()),
      kind: 'pickup',
      type,
      value: type === 'pearl' ? 1 + Math.floor(actorClamp(Number(rng()) || 0, 0, 0.999999) * 5) : 0,
      radius: 1.2,
      biome,
      position: spawnPointInBiome(biome, bounds, rng),
    };
  });
  return { hazards, pickups };
}

export function resolveHazardContact(player, hazard, now = 0) {
  if (hazard?.type !== 'jelly' || !contacts(player, hazard)) return { hit: false, player: { ...player } };
  const timestamp = Number.isFinite(now) ? now : 0;
  return {
    hit: true,
    player: {
      ...player,
      slowUntil: Math.max(actorFinite(player?.slowUntil), timestamp + HAZARD_SLOW_MS),
    },
  };
}

export function resolvePickupContact(player, pickup, now = 0) {
  if (!['current', 'pearl'].includes(pickup?.type) || !contacts(player, pickup)) {
    return { consumed: false, player: { ...player } };
  }
  const timestamp = Number.isFinite(now) ? now : 0;
  if (pickup.type === 'current') {
    return {
      consumed: true,
      player: {
        ...player,
        speedBoostUntil: Math.max(actorFinite(player?.speedBoostUntil), timestamp + PICKUP_SPEED_MS),
      },
    };
  }
  const value = actorClamp(Math.floor(actorFinite(pickup.value) || 1), 1, 5);
  return {
    consumed: true,
    player: {
      ...player,
      bonusPearls: Math.min(100, Math.floor(Math.max(0, actorFinite(player?.bonusPearls))) + value),
    },
  };
}