export const QUALITY_PROFILES = Object.freeze({
  high: Object.freeze({ dpr: 2, bubbles: 260, plankton: 420, rocks: 28, kelp: 34, coral: 22, shafts: 8, effectParticles: 36 }),
  medium: Object.freeze({ dpr: 1.5, bubbles: 170, plankton: 260, rocks: 18, kelp: 22, coral: 14, shafts: 5, effectParticles: 24 }),
  low: Object.freeze({ dpr: 1, bubbles: 90, plankton: 120, rocks: 10, kelp: 12, coral: 7, shafts: 3, effectParticles: 14 }),
});

export function resolveQuality(requested = 'auto') {
  let normalized = String(requested || 'auto').toLowerCase();
  if (normalized === 'balanced') normalized = 'medium';
  if (normalized !== 'auto' && QUALITY_PROFILES[normalized]) return normalized;
  const coarse = globalThis.matchMedia?.('(pointer: coarse)')?.matches;
  const narrow = globalThis.innerWidth ? globalThis.innerWidth < 820 : false;
  const highDpr = globalThis.devicePixelRatio ? globalThis.devicePixelRatio > 2 : false;
  if (coarse || narrow) return 'medium';
  if (highDpr) return 'medium';
  return 'high';
}

export function qualityProfile(requested = 'auto') {
  return QUALITY_PROFILES[resolveQuality(requested)];
}

export const CAMERA = Object.freeze({
  fov: 62,
  near: 0.1,
  far: 420,
  follow: 0.065,
});

export const WORLD_VISUAL_RADIUS = 105;
