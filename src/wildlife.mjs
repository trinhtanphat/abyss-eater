import { biomeForPosition } from './world.mjs';
import { buildSpatialBuckets, nearbyFromBuckets } from './spatial-grid.mjs';

export const WILDLIFE_COUNT = 24;
export const WILDLIFE_STEP_MS = 250;
export const WILDLIFE_UPDATE_BUDGET = 8;

const WILDLIFE_MASS_TIERS = [0.45, 0.6, 0.7, 0.82, 1.05, 1.25, 1.5, 1.8, 2.4, 3.2, 4.6, 6.2];
const WILDLIFE_NAMES = ['Silver Fry', 'Reef Dart', 'Glass Minnow', 'Coral Runner', 'Blue Scout', 'Reef Grazer', 'Amber Snapper', 'Barracuda', 'Needle Hunter', 'Deep Fang', 'Abyss Hunter', 'Voidjaw'];
const WILDLIFE_MAX_STEP_SECONDS = 0.25;
const WILDLIFE_QUERY_CELL_SIZE = 24;

function wildlifeFinite(value) {
  return Number.isFinite(value) ? value : 0;
}

function wildlifeClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wildlifeNormalized(vector) {
  const raw = {
    x: wildlifeFinite(vector?.x),
    y: wildlifeFinite(vector?.y),
    z: wildlifeFinite(vector?.z),
  };
  const length = Math.hypot(raw.x, raw.y, raw.z);
  if (length <= 1e-9) return { x: 1, y: 0, z: 0 };
  return { x: raw.x / length, y: raw.y / length, z: raw.z / length };
}

function wildlifeSeededHeading(seed, time = 0) {
  const phase = wildlifeFinite(seed) * 1.61803398875 + wildlifeFinite(time) * 0.00013;
  return wildlifeNormalized({
    x: Math.cos(phase),
    y: Math.sin(phase * 0.57) * 0.35,
    z: Math.sin(phase),
  });
}

function wildlifePositionOf(value) {
  return value?.position || { x: 0, y: 0, z: 0 };
}

function wildlifeDistance3(a, b) {
  return Math.hypot(
    wildlifeFinite(a?.x) - wildlifeFinite(b?.x),
    wildlifeFinite(a?.y) - wildlifeFinite(b?.y),
    wildlifeFinite(a?.z) - wildlifeFinite(b?.z),
  );
}

function nearestWildlifeMatch(actor, players, predicate, maxDistance) {
  let nearest = null;
  for (const player of Array.isArray(players) ? players : []) {
    if (!player?.position || !Number.isFinite(player.mass) || !predicate(player)) continue;
    const distance = wildlifeDistance3(actor.position, player.position);
    if (distance > maxDistance) continue;
    if (!nearest || distance < nearest.distance) nearest = { player, distance };
  }
  return nearest;
}

function speedForWildlife(mass) {
  const size = Math.cbrt(Math.max(0.2, wildlifeFinite(mass) || 1));
  return wildlifeClamp(7.4 / size, 2.8, 8.4);
}

function wildlifeTierFor(index) {
  const tierIndex = Math.abs(Math.trunc(index)) % WILDLIFE_MASS_TIERS.length;
  return { mass: WILDLIFE_MASS_TIERS[tierIndex], name: WILDLIFE_NAMES[tierIndex] };
}

export function wildlifeBehaviorFor(actor = {}) {
  const mass = Math.max(0.2, Number(actor.mass) || 1);
  if (mass >= 4.6) return 'apex';
  if (mass >= 1.5) return 'hunt';
  if (mass >= 0.9) return 'flee';
  return 'school';
}

export function makeWildlifePopulation(spawnPoint, idFactory) {
  const spawn = typeof spawnPoint === 'function' ? spawnPoint : () => ({ x: 0, y: 0, z: 0 });
  const makeId = typeof idFactory === 'function' ? idFactory : (() => {
    let id = 0;
    return () => `wild-${++id}`;
  })();
  return Array.from({ length: WILDLIFE_COUNT }, (_, index) => {
    const tier = wildlifeTierFor(index);
    const seed = index + 1;
    const position = { ...spawn() };
    const behavior = wildlifeBehaviorFor(tier);
    return {
      id: String(makeId()),
      kind: 'wildlife',
      name: tier.name,
      mass: tier.mass,
      position,
      heading: wildlifeSeededHeading(seed),
      behavior,
      aiState: 'wander',
      biome: biomeForPosition(position, { x: 80, y: 28, z: 80 }),
      seed,
    };
  });
}

export function respawnWildlife(actor, spawnPoint, bounds = { x: 80, y: 28, z: 80 }) {
  const spawn = typeof spawnPoint === 'function' ? spawnPoint() : spawnPoint;
  const seed = Math.max(1, Math.trunc(wildlifeFinite(actor?.seed)) + 17);
  const position = {
    x: wildlifeFinite(spawn?.x),
    y: wildlifeFinite(spawn?.y),
    z: wildlifeFinite(spawn?.z),
  };
  return {
    ...actor,
    kind: 'wildlife',
    position,
    heading: wildlifeSeededHeading(seed),
    behavior: wildlifeBehaviorFor(actor),
    aiState: 'wander',
    biome: biomeForPosition(position, bounds),
    seed,
  };
}

export function stepWildlife(population, players, dt, bounds, now = 0) {
  const source = Array.isArray(population) ? population : [];
  const step = wildlifeClamp(wildlifeFinite(dt), 0, WILDLIFE_MAX_STEP_SECONDS);
  const safeBounds = {
    x: Math.max(1, Math.abs(wildlifeFinite(bounds?.x)) || 80),
    y: Math.max(1, Math.abs(wildlifeFinite(bounds?.y)) || 28),
    z: Math.max(1, Math.abs(wildlifeFinite(bounds?.z)) || 80),
  };
  const playerBuckets = buildSpatialBuckets(Array.isArray(players) ? players : [], WILDLIFE_QUERY_CELL_SIZE);
  const start = source.length ? Math.abs(Math.floor(wildlifeFinite(now) / WILDLIFE_STEP_MS)) % source.length : 0;
  const updateIds = new Set(Array.from(
    { length: Math.min(WILDLIFE_UPDATE_BUDGET, source.length) },
    (_, offset) => source[(start + offset) % source.length]?.id,
  ));

  return source.map((actor, index) => {
    const mass = Math.max(0.2, wildlifeFinite(actor?.mass) || 1);
    const position = wildlifePositionOf(actor);
    const behavior = wildlifeBehaviorFor({ ...actor, mass });
    const biome = biomeForPosition(position, safeBounds);
    if (!updateIds.has(actor?.id)) {
      return { ...actor, kind: 'wildlife', mass, behavior, aiState: actor?.aiState || 'wander', biome };
    }

    const nearbyPlayers = nearbyFromBuckets(playerBuckets, position, WILDLIFE_QUERY_CELL_SIZE);
    const threat = nearestWildlifeMatch(
      actor,
      nearbyPlayers,
      (player) => player.mass >= mass * 1.15,
      22,
    );
    const prey = nearestWildlifeMatch(
      actor,
      nearbyPlayers,
      (player) => mass >= player.mass * 1.15,
      24,
    );

    let desired = wildlifeSeededHeading(wildlifeFinite(actor?.seed) || index + 1, now);
    let aiState = 'wander';
    if (behavior === 'apex') {
      if (prey?.distance <= 9) aiState = 'chase';
      else if (prey) aiState = 'stalk';
      if (prey) {
        desired = wildlifeNormalized({
          x: wildlifeFinite(prey.player.position.x) - wildlifeFinite(position.x),
          y: wildlifeFinite(prey.player.position.y) - wildlifeFinite(position.y),
          z: wildlifeFinite(prey.player.position.z) - wildlifeFinite(position.z),
        });
      }
    } else if (threat && mass <= 1.5) {
      aiState = 'flee';
      desired = wildlifeNormalized({
        x: wildlifeFinite(position.x) - wildlifeFinite(threat.player.position.x),
        y: wildlifeFinite(position.y) - wildlifeFinite(threat.player.position.y),
        z: wildlifeFinite(position.z) - wildlifeFinite(threat.player.position.z),
      });
    } else if (prey && behavior === 'hunt') {
      aiState = 'hunt';
      desired = wildlifeNormalized({
        x: wildlifeFinite(prey.player.position.x) - wildlifeFinite(position.x),
        y: wildlifeFinite(prey.player.position.y) - wildlifeFinite(position.y),
        z: wildlifeFinite(prey.player.position.z) - wildlifeFinite(position.z),
      });
    } else if (behavior === 'school') {
      aiState = 'school';
      if (actor?.heading) {
        const wander = wildlifeSeededHeading(wildlifeFinite(actor.seed) || index + 1, now);
        desired = wildlifeNormalized({
          x: wildlifeFinite(actor.heading.x) * 0.78 + wander.x * 0.22,
          y: wildlifeFinite(actor.heading.y) * 0.78 + wander.y * 0.22,
          z: wildlifeFinite(actor.heading.z) * 0.78 + wander.z * 0.22,
        });
      }
    } else if (actor?.heading) {
      const wander = wildlifeSeededHeading(wildlifeFinite(actor.seed) || index + 1, now);
      desired = wildlifeNormalized({
        x: wildlifeFinite(actor.heading.x) * 0.78 + wander.x * 0.22,
        y: wildlifeFinite(actor.heading.y) * 0.78 + wander.y * 0.22,
        z: wildlifeFinite(actor.heading.z) * 0.78 + wander.z * 0.22,
      });
    }

    const margin = Math.min(4, 0.12 * Math.min(safeBounds.x, safeBounds.y, safeBounds.z));
    if (Math.abs(wildlifeFinite(position.x)) > safeBounds.x - margin) desired.x -= Math.sign(wildlifeFinite(position.x)) * 1.4;
    if (Math.abs(wildlifeFinite(position.y)) > safeBounds.y - margin) desired.y -= Math.sign(wildlifeFinite(position.y)) * 1.4;
    if (Math.abs(wildlifeFinite(position.z)) > safeBounds.z - margin) desired.z -= Math.sign(wildlifeFinite(position.z)) * 1.4;
    desired = wildlifeNormalized(desired);

    const speed = speedForWildlife(mass);
    const nextPosition = {
      x: wildlifeClamp(wildlifeFinite(position.x) + desired.x * speed * step, -safeBounds.x, safeBounds.x),
      y: wildlifeClamp(wildlifeFinite(position.y) + desired.y * speed * step, -safeBounds.y, safeBounds.y),
      z: wildlifeClamp(wildlifeFinite(position.z) + desired.z * speed * step, -safeBounds.z, safeBounds.z),
    };
    return {
      ...actor,
      kind: 'wildlife',
      mass,
      heading: desired,
      behavior,
      aiState,
      biome: biomeForPosition(nextPosition, safeBounds),
      position: nextPosition,
    };
  });
}