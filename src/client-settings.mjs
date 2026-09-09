export const DEFAULT_SETTINGS = Object.freeze({
  quality: 'auto',
  reducedEffects: false,
  master: 0.65,
  music: 0.35,
  sfx: 0.75,
  ttsEnabled: false,
  tts: 0.8,
});

const QUALITY_VALUES = new Set(['auto', 'low', 'medium', 'high']);

function boundedVolume(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

export function normalizeSettings(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    quality: QUALITY_VALUES.has(source.quality) ? source.quality : DEFAULT_SETTINGS.quality,
    reducedEffects: source.reducedEffects === true,
    master: boundedVolume(source.master, DEFAULT_SETTINGS.master),
    music: boundedVolume(source.music, DEFAULT_SETTINGS.music),
    sfx: boundedVolume(source.sfx, DEFAULT_SETTINGS.sfx),
    ttsEnabled: source.ttsEnabled === true,
    tts: boundedVolume(source.tts, DEFAULT_SETTINGS.tts),
  };
}

const PRESETS = Object.freeze({
  low: Object.freeze({ pixelRatioCap: 1, bubbles: 90, shadows: false, decorativeDistance: 45 }),
  medium: Object.freeze({ pixelRatioCap: 1.5, bubbles: 220, shadows: false, decorativeDistance: 70 }),
  high: Object.freeze({ pixelRatioCap: 2, bubbles: 360, shadows: true, decorativeDistance: 100 }),
});

export function resolveQualityPreset(settings = DEFAULT_SETTINGS, environment = {}) {
  const normalized = normalizeSettings(settings);
  let quality = normalized.quality;
  if (quality === 'auto') {
    const width = Number.isFinite(environment.width) ? environment.width : 0;
    const devicePixelRatio = Number.isFinite(environment.devicePixelRatio) ? environment.devicePixelRatio : 1;
    const constrained = normalized.reducedEffects === true || environment.coarsePointer === true || width < 760;
    if (constrained) quality = 'low';
    else if (width >= 1200 && devicePixelRatio <= 2) quality = 'high';
    else quality = 'medium';
  }
  return { ...PRESETS[quality] };
}
