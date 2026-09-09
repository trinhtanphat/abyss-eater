const freezeProfile = (profile) => Object.freeze({
  ...profile,
  body: Object.freeze([...profile.body]),
  tail: Object.freeze([...profile.tail]),
  fin: Object.freeze([...profile.fin]),
});

export const EVOLUTION_TIERS = Object.freeze([
  freezeProfile({
    id: 'fry',
    minMass: 1,
    body: [1.66, 0.9, 0.84],
    tail: [0.82, 0.78, 0.28],
    fin: [0.78, 0.72, 0.2],
    eyeScale: 1.12,
    mouthScale: 0.78,
    snoutScale: 0.72,
    spineCount: 0,
  }),
  freezeProfile({
    id: 'reefling',
    minMass: 2,
    body: [1.8, 0.85, 0.79],
    tail: [0.94, 0.9, 0.3],
    fin: [0.9, 0.86, 0.22],
    eyeScale: 1.04,
    mouthScale: 0.9,
    snoutScale: 0.82,
    spineCount: 0,
  }),
  freezeProfile({
    id: 'hunter',
    minMass: 4,
    body: [1.94, 0.78, 0.72],
    tail: [1.06, 1.02, 0.32],
    fin: [1.04, 0.98, 0.24],
    eyeScale: 0.98,
    mouthScale: 1.05,
    snoutScale: 0.94,
    spineCount: 1,
  }),
  freezeProfile({
    id: 'razorfin',
    minMass: 8,
    body: [2.1, 0.74, 0.68],
    tail: [1.18, 1.12, 0.34],
    fin: [1.18, 1.16, 0.27],
    eyeScale: 0.92,
    mouthScale: 1.2,
    snoutScale: 1.06,
    spineCount: 2,
  }),
  freezeProfile({
    id: 'abyss-predator',
    minMass: 16,
    body: [2.28, 0.71, 0.65],
    tail: [1.34, 1.24, 0.37],
    fin: [1.34, 1.34, 0.3],
    eyeScale: 0.86,
    mouthScale: 1.38,
    snoutScale: 1.18,
    spineCount: 3,
  }),
  freezeProfile({
    id: 'leviathan',
    minMass: 32,
    body: [2.5, 0.68, 0.62],
    tail: [1.5, 1.38, 0.4],
    fin: [1.5, 1.52, 0.34],
    eyeScale: 0.8,
    mouthScale: 1.6,
    snoutScale: 1.34,
    spineCount: 4,
  }),
]);

function normalizedMass(mass) {
  const value = Number(mass);
  return Number.isFinite(value) && value >= 1 ? value : 1;
}

export function evolutionTierForMass(mass) {
  const value = normalizedMass(mass);
  const index = Math.min(EVOLUTION_TIERS.length - 1, Math.max(0, Math.floor(Math.log2(value))));
  return EVOLUTION_TIERS[index].id;
}

export function silhouetteForMass(mass) {
  const id = evolutionTierForMass(mass);
  return EVOLUTION_TIERS.find((tier) => tier.id === id) || EVOLUTION_TIERS[0];
}
