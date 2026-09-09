export const XP_PER_LEVEL = 1000;
export const MAX_LEVEL = 50;

export const SKIN_CATALOG = Object.freeze([
  Object.freeze({
    id: 'reef-glow',
    title: 'Reef Glow',
    unlockLevel: 1,
    pearlCost: 0,
    visual: Object.freeze({ bodyColor: 0x32d9d1, accentColor: 0x8ff7ee, emissive: 0.28, roughness: 0.42 }),
  }),
  Object.freeze({
    id: 'coral-runner',
    title: 'Coral Runner',
    unlockLevel: 3,
    pearlCost: 40,
    visual: Object.freeze({ bodyColor: 0xff756d, accentColor: 0xffc56e, emissive: 0.22, roughness: 0.5 }),
  }),
  Object.freeze({
    id: 'abyss-veil',
    title: 'Abyss Veil',
    unlockLevel: 8,
    pearlCost: 120,
    visual: Object.freeze({ bodyColor: 0x4157ff, accentColor: 0x9e8cff, emissive: 0.12, roughness: 0.66 }),
  }),
]);

function boundedFinite(value, min, max) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

export function levelForXp(xp) {
  const safeXp = boundedFinite(xp, 0, Number.MAX_SAFE_INTEGER);
  return Math.min(MAX_LEVEL, 1 + Math.floor(safeXp / XP_PER_LEVEL));
}

export function rewardForCheckpoint(checkpoint = {}) {
  const scoreDelta = boundedFinite(checkpoint.scoreDelta, 0, 25000);
  const peakMass = boundedFinite(checkpoint.peakMass, 0, 50);
  const playerEats = boundedFinite(checkpoint.playerEats, 0, 20);
  const survivedMs = boundedFinite(checkpoint.survivedMs, 0, 1800000);

  const scoreXp = Math.floor(scoreDelta * 0.1);
  const massXp = Math.floor(Math.max(0, peakMass - 1) * 20);
  const eatXp = Math.floor(playerEats) * 75;
  const survivalXp = Math.floor(survivedMs / 10000);
  const xp = Math.min(5000, scoreXp + massXp + eatXp + survivalXp);
  return { xp, pearls: Math.min(25, Math.floor(xp / 250)) };
}

export function skinById(id) {
  return SKIN_CATALOG.find((skin) => skin.id === id) || null;
}
