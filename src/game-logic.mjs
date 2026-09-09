export const START_MASS = 1;
export const FOOD_RADIUS = 0.45;
export const MAX_STEP_SECONDS = 0.25;

function finite(value) {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance3(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(
    finite(a.x) - finite(b.x),
    finite(a.y) - finite(b.y),
    finite(a.z) - finite(b.z),
  );
}

export function roomIdFor(label, poolSize = 64) {
  const slots = Number.isSafeInteger(poolSize) && poolSize > 0 ? poolSize : 64;
  const normalized = (String(label ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim() || 'ocean');
  let hash = 2166136261;
  for (const char of normalized) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `ocean-${(hash % slots) + 1}`;
}

export function shouldBroadcast(lastBroadcastAt, now, minIntervalMs = 50) {
  if (!Number.isFinite(lastBroadcastAt) || lastBroadcastAt <= 0) return true;
  if (!Number.isFinite(now) || now < lastBroadcastAt) return true;
  const interval = Number.isFinite(minIntervalMs) && minIntervalMs > 0 ? minIntervalMs : 50;
  return now - lastBroadcastAt >= interval;
}

export function clampDirection(dir = {}) {
  const raw = {
    x: finite(dir.x),
    y: finite(dir.y),
    z: finite(dir.z),
  };
  const length = Math.hypot(raw.x, raw.y, raw.z);
  if (length === 0) return raw;
  if (length <= 1) return raw;
  return {
    x: raw.x / length,
    y: raw.y / length,
    z: raw.z / length,
  };
}

export function radiusForMass(mass) {
  return Math.cbrt(Math.max(START_MASS, finite(mass) || START_MASS)) * 1.2;
}

export function speedForMass(mass) {
  const scale = Math.cbrt(Math.max(START_MASS, finite(mass) || START_MASS));
  return Math.max(4, 12 / (1 + (scale - 1) * 0.22));
}

export function advancePlayer(player, dir, dt, bounds) {
  const direction = clampDirection(dir);
  const step = clamp(finite(dt), 0, MAX_STEP_SECONDS);
  const speed = speedForMass(player.mass);
  const position = player.position ?? { x: 0, y: 0, z: 0 };
  return {
    ...player,
    position: {
      x: clamp(finite(position.x) + direction.x * speed * step, -bounds.x, bounds.x),
      y: clamp(finite(position.y) + direction.y * speed * step, -bounds.y, bounds.y),
      z: clamp(finite(position.z) + direction.z * speed * step, -bounds.z, bounds.z),
    },
  };
}

export function canEat(predator, prey) {
  if (!predator || !prey || predator === prey) return false;
  const predatorMass = predator.mass;
  const preyMass = prey.mass;
  if (!Number.isFinite(predatorMass) || !Number.isFinite(preyMass)) return false;
  if (predatorMass < START_MASS || preyMass < START_MASS) return false;
  if (predatorMass < preyMass * 1.15) return false;
  const reach = radiusForMass(predatorMass) + radiusForMass(preyMass) * 0.35;
  return distance3(predator.position, prey.position) <= reach;
}

export function resolveEatPair(a, b) {
  const aCanEat = canEat(a, b);
  const bCanEat = canEat(b, a);
  if (aCanEat && !bCanEat) return 'a';
  if (bCanEat && !aCanEat) return 'b';
  if (!aCanEat && !bCanEat) return null;
  if (a.mass !== b.mass) return a.mass > b.mass ? 'a' : 'b';
  return String(a.id ?? '') <= String(b.id ?? '') ? 'a' : 'b';
}

export function collectFood(player, food) {
  const value = Math.max(0, finite(food?.value));
  const eaten = distance3(player.position, food.position) <= radiusForMass(player.mass) + FOOD_RADIUS;
  if (!eaten) return { eaten: false, player: { ...player } };
  return {
    eaten: true,
    player: {
      ...player,
      mass: finite(player.mass) + value,
      score: Math.max(0, Math.round(finite(player.score))) + Math.round(value * 100),
    },
  };
}

export function respawnPlayer(player, spawn) {
  return {
    ...player,
    mass: START_MASS,
    score: 0,
    deaths: Math.max(0, Math.round(finite(player.deaths))) + 1,
    position: {
      x: finite(spawn.x),
      y: finite(spawn.y),
      z: finite(spawn.z),
    },
  };
}
