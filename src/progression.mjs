export const SKIN_CATALOG = Object.freeze([
  Object.freeze({ id: 'reef', title: 'Reef', price: 0, unlockLevel: 1, bodyColor: '#5de7d7', accentColor: '#d9fff7', emissive: '#0f746f' }),
  Object.freeze({ id: 'azure', title: 'Azure Current', price: 50, unlockLevel: 2, bodyColor: '#4ca7ff', accentColor: '#d9efff', emissive: '#174f96' }),
  Object.freeze({ id: 'abyssal', title: 'Abyssal Glow', price: 140, unlockLevel: 4, bodyColor: '#705dff', accentColor: '#e2ddff', emissive: '#34207f' }),
  Object.freeze({ id: 'sunset', title: 'Sunset Koi', price: 240, unlockLevel: 6, bodyColor: '#ff8a5c', accentColor: '#fff0d7', emissive: '#8c3523' }),
]);

function nonNegativeFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function levelForXp(value) {
  const xp = nonNegativeFinite(value);
  // Level N begins at 100 * (N - 1) * N / 2 cumulative XP.
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * xp) / 100)) / 2));
}

export function rewardForSession(summary = {}) {
  const score = Math.floor(nonNegativeFinite(summary?.score));
  const massGain = Math.max(0, nonNegativeFinite(summary?.mass) - 1);
  const xp = Math.min(5000, Math.floor(score * 2 + massGain * 10));
  const pearls = Math.min(500, Math.floor(score / 5 + massGain * 2));
  return { xp, pearls };
}

export function skinById(id) {
  if (typeof id !== 'string') return null;
  return SKIN_CATALOG.find((skin) => skin.id === id) ?? null;
}

export function seasonForTimestamp(value) {
  const timestamp = Number(value);
  const safe = Number.isFinite(timestamp) && timestamp >= 0 ? Math.floor(timestamp) : 0;
  const date = new Date(safe);
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${year}-q${quarter}`;
}
