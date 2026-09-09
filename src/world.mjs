export const BIOME_IDS = Object.freeze(['surface', 'reef', 'deep', 'abyss']);

const PROFILES = Object.freeze({
  surface: Object.freeze({ id: 'surface', minDepth: 0, maxDepth: 0.25, risk: 0.15, foodWeight: 1, pickupWeight: 0.5 }),
  reef: Object.freeze({ id: 'reef', minDepth: 0.25, maxDepth: 0.5, risk: 0.35, foodWeight: 1.25, pickupWeight: 0.8 }),
  deep: Object.freeze({ id: 'deep', minDepth: 0.5, maxDepth: 0.75, risk: 0.65, foodWeight: 1.4, pickupWeight: 1.1 }),
  abyss: Object.freeze({ id: 'abyss', minDepth: 0.75, maxDepth: 1, risk: 1, foodWeight: 1.55, pickupWeight: 1.35 }),
});

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function safeBound(value, fallback) {
  return Math.max(1, Math.abs(Number(value)) || fallback);
}

export function normalizedDepth(position = {}, bounds = {}) {
  const halfHeight = safeBound(bounds.y, 28);
  const y = Number.isFinite(position?.y) ? position.y : 0;
  return clamp01((halfHeight - y) / (halfHeight * 2));
}

export function biomeForPosition(position = {}, bounds = {}) {
  if (!Number.isFinite(position?.y)) return 'reef';
  const depth = normalizedDepth(position, bounds);
  if (depth < 0.25) return 'surface';
  if (depth < 0.5) return 'reef';
  if (depth < 0.75) return 'deep';
  return 'abyss';
}

export function biomeProfile(id) {
  return PROFILES[BIOME_IDS.includes(id) ? id : 'reef'];
}

export function spawnPointInBiome(id, bounds = {}, random = Math.random) {
  const profile = biomeProfile(id);
  const halfX = safeBound(bounds.x, 80);
  const halfY = safeBound(bounds.y, 28);
  const halfZ = safeBound(bounds.z, 80);
  const rng = typeof random === 'function' ? random : Math.random;
  const sample = () => clamp01(Number(rng()) || 0);
  const inset = 0.08;
  const bandWidth = profile.maxDepth - profile.minDepth;
  const depth = profile.minDepth + bandWidth * (inset + sample() * (1 - inset * 2));
  return {
    x: (sample() * 2 - 1) * halfX * 0.72,
    y: halfY - depth * halfY * 2,
    z: (sample() * 2 - 1) * halfZ * 0.72,
  };
}