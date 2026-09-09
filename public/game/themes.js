const STYLIZED = Object.freeze({
  id: 'stylized',
  label: 'Sunken Reef',
  scene: Object.freeze({ background: 0x031827, fog: 0x062434, fogDensity: 0.0115 }),
  lighting: Object.freeze({ sky: 0x91f3ff, ground: 0x011420, hemi: 1.25, sun: 0xb9f6ff, sunIntensity: 1.35, accent: 0x2bd7de, accentIntensity: 0.8 }),
  floor: Object.freeze({ color: 0x0a3f51, roughness: 0.96, emissive: 0x021419, emissiveIntensity: 0.15 }),
  water: Object.freeze({ bubble: 0x9af4ff, plankton: 0x7ff6d7, shaft: 0x89edff }),
  decor: Object.freeze({ rock: 0x164858, kelp: 0x1b826f, coral: 0xff8d9f, coralAlt: 0xffc66b, accent: 0xffdd8a, accentAlt: 0x76f0d6 }),
  food: Object.freeze({ color: 0x92ffe0, emissive: 0x1bbf92, emissiveIntensity: 1.9 }),
  fish: Object.freeze({ local: 0x66efff, saturation: 0.72, lightness: 0.58, roughness: 0.38, metalness: 0.08, emissiveBoost: 0.28, eye: 0xf4feff, pupil: 0x00131b }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.34, planktonOpacity: 0.42, bubbleSize: 0.16, planktonSize: 0.09, shaftOpacity: 0.035, shaftWidth: 1, ringOpacity: 0.035, drift: 0.018, sway: 1 }),
  css: Object.freeze({ accent: '#66efff', accent2: '#8dffd8', danger: '#ff708d', themeColor: '#031827' }),
});

const DEEP_SEA = Object.freeze({
  id: 'deep-sea',
  label: 'Ancient Abyss',
  scene: Object.freeze({ background: 0x01070c, fog: 0x031217, fogDensity: 0.0195 }),
  lighting: Object.freeze({ sky: 0x406b72, ground: 0x000406, hemi: 0.7, sun: 0x739aa0, sunIntensity: 0.68, accent: 0x1c6d68, accentIntensity: 0.32 }),
  floor: Object.freeze({ color: 0x071517, roughness: 1, emissive: 0x010506, emissiveIntensity: 0.04 }),
  water: Object.freeze({ bubble: 0x769fa5, plankton: 0x7cb7a3, shaft: 0x527a7d }),
  decor: Object.freeze({ rock: 0x101b1c, kelp: 0x173e37, coral: 0x5c4544, coralAlt: 0x665b42, accent: 0x8b8774, accentAlt: 0x3c6762 }),
  food: Object.freeze({ color: 0xa5d9ca, emissive: 0x356e60, emissiveIntensity: 0.92 }),
  fish: Object.freeze({ local: 0x8bc0c5, saturation: 0.46, lightness: 0.44, roughness: 0.72, metalness: 0.015, emissiveBoost: 0.06, eye: 0xd7d9cf, pupil: 0x020504 }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.17, planktonOpacity: 0.33, bubbleSize: 0.105, planktonSize: 0.052, shaftOpacity: 0.014, shaftWidth: 0.62, ringOpacity: 0.012, drift: 0.011, sway: 0.62 }),
  css: Object.freeze({ accent: '#8bc0c5', accent2: '#9fcdbd', danger: '#e37984', themeColor: '#01070c' }),
});

const TWILIGHT_GARDEN = Object.freeze({
  id: 'twilight-garden',
  label: 'Twilight Garden',
  scene: Object.freeze({ background: 0x07091d, fog: 0x111a3a, fogDensity: 0.0148 }),
  lighting: Object.freeze({ sky: 0x8ea8ff, ground: 0x040817, hemi: 0.96, sun: 0xa6d5ff, sunIntensity: 0.9, accent: 0xa66cff, accentIntensity: 0.68 }),
  floor: Object.freeze({ color: 0x172c48, roughness: 0.98, emissive: 0x0b1029, emissiveIntensity: 0.12 }),
  water: Object.freeze({ bubble: 0xa7d7ff, plankton: 0xd28cff, shaft: 0x758cff }),
  decor: Object.freeze({ rock: 0x263650, kelp: 0x385d68, coral: 0x9f70ff, coralAlt: 0x5ee6cf, accent: 0xdc8fff, accentAlt: 0x80f3df }),
  food: Object.freeze({ color: 0xd9a8ff, emissive: 0x8648de, emissiveIntensity: 1.72 }),
  fish: Object.freeze({ local: 0x78efff, saturation: 0.68, lightness: 0.56, roughness: 0.46, metalness: 0.06, emissiveBoost: 0.22, eye: 0xf5f1ff, pupil: 0x09061b }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.27, planktonOpacity: 0.48, bubbleSize: 0.13, planktonSize: 0.075, shaftOpacity: 0.026, shaftWidth: 0.82, ringOpacity: 0.026, drift: 0.015, sway: 1.15 }),
  css: Object.freeze({ accent: '#80eaff', accent2: '#c98cff', danger: '#ff6f98', themeColor: '#07091d' }),
});

const BLUE_TRENCH = Object.freeze({
  id: 'blue-trench',
  label: 'Blue Trench',
  scene: Object.freeze({ background: 0x01101a, fog: 0x052737, fogDensity: 0.017 }),
  lighting: Object.freeze({ sky: 0x5dbbd0, ground: 0x001018, hemi: 0.82, sun: 0x7bd8e4, sunIntensity: 0.72, accent: 0x25aac4, accentIntensity: 0.48 }),
  floor: Object.freeze({ color: 0x092b38, roughness: 1, emissive: 0x03151c, emissiveIntensity: 0.08 }),
  water: Object.freeze({ bubble: 0x75cadc, plankton: 0x79e7db, shaft: 0x4db8c8 }),
  decor: Object.freeze({ rock: 0x183844, kelp: 0x184f53, coral: 0x418b90, coralAlt: 0x597f8c, accent: 0x5bd6d6, accentAlt: 0x6a94b8 }),
  food: Object.freeze({ color: 0x88eee0, emissive: 0x197e79, emissiveIntensity: 1.25 }),
  fish: Object.freeze({ local: 0x63deea, saturation: 0.58, lightness: 0.5, roughness: 0.6, metalness: 0.035, emissiveBoost: 0.14, eye: 0xe9fbff, pupil: 0x00141d }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.2, planktonOpacity: 0.4, bubbleSize: 0.115, planktonSize: 0.06, shaftOpacity: 0.02, shaftWidth: 0.7, ringOpacity: 0.02, drift: 0.012, sway: 0.72 }),
  css: Object.freeze({ accent: '#63deea', accent2: '#78e7d4', danger: '#ff7182', themeColor: '#01101a' }),
});

const VOLCANIC_RIFT = Object.freeze({
  id: 'volcanic-rift',
  label: 'Volcanic Rift',
  scene: Object.freeze({ background: 0x09080a, fog: 0x171013, fogDensity: 0.0168 }),
  lighting: Object.freeze({ sky: 0x77534b, ground: 0x070506, hemi: 0.58, sun: 0xd58b70, sunIntensity: 0.58, accent: 0xff6a36, accentIntensity: 0.7 }),
  floor: Object.freeze({ color: 0x1a1617, roughness: 1, emissive: 0x2b0e06, emissiveIntensity: 0.16 }),
  water: Object.freeze({ bubble: 0xb49b92, plankton: 0xff9b55, shaft: 0xd66c4c }),
  decor: Object.freeze({ rock: 0x252123, kelp: 0x40342c, coral: 0x743226, coralAlt: 0xa96a38, accent: 0xff6f32, accentAlt: 0xffb24c }),
  food: Object.freeze({ color: 0xffbd72, emissive: 0xd84d18, emissiveIntensity: 1.75 }),
  fish: Object.freeze({ local: 0x68e6ed, saturation: 0.66, lightness: 0.5, roughness: 0.57, metalness: 0.05, emissiveBoost: 0.18, eye: 0xffefe4, pupil: 0x190704 }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.24, planktonOpacity: 0.34, bubbleSize: 0.14, planktonSize: 0.07, shaftOpacity: 0.018, shaftWidth: 0.58, ringOpacity: 0.018, drift: 0.014, sway: 0.66 }),
  css: Object.freeze({ accent: '#ff9a58', accent2: '#62e5e3', danger: '#ff5d64', themeColor: '#09080a' }),
});

const LEVIATHAN_DEPTHS = Object.freeze({
  id: 'leviathan-depths',
  label: 'Leviathan Depths',
  scene: Object.freeze({ background: 0x000307, fog: 0x030914, fogDensity: 0.0215 }),
  lighting: Object.freeze({ sky: 0x263655, ground: 0x000205, hemi: 0.48, sun: 0x4c6f89, sunIntensity: 0.42, accent: 0x4f66ff, accentIntensity: 0.58 }),
  floor: Object.freeze({ color: 0x070b12, roughness: 1, emissive: 0x02030a, emissiveIntensity: 0.03 }),
  water: Object.freeze({ bubble: 0x4d6a79, plankton: 0x7d6cff, shaft: 0x394c78 }),
  decor: Object.freeze({ rock: 0x0d141e, kelp: 0x101d25, coral: 0x27234c, coralAlt: 0x27494b, accent: 0x725aff, accentAlt: 0x46d5ca }),
  food: Object.freeze({ color: 0xb09cff, emissive: 0x5441ca, emissiveIntensity: 1.35 }),
  fish: Object.freeze({ local: 0x6eeeff, saturation: 0.5, lightness: 0.4, roughness: 0.7, metalness: 0.02, emissiveBoost: 0.09, eye: 0xe6eaff, pupil: 0x010208 }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.11, planktonOpacity: 0.4, bubbleSize: 0.09, planktonSize: 0.05, shaftOpacity: 0.01, shaftWidth: 0.5, ringOpacity: 0.01, drift: 0.009, sway: 0.48 }),
  css: Object.freeze({ accent: '#6eeeff', accent2: '#8c72ff', danger: '#ff526d', themeColor: '#000307' }),
});

const THEMES = Object.freeze({
  stylized: STYLIZED,
  'deep-sea': DEEP_SEA,
  'twilight-garden': TWILIGHT_GARDEN,
  'blue-trench': BLUE_TRENCH,
  'volcanic-rift': VOLCANIC_RIFT,
  'leviathan-depths': LEVIATHAN_DEPTHS,
});

export function getTheme(id = 'stylized') {
  return THEMES[id] || STYLIZED;
}

export function themeIds() {
  return Object.keys(THEMES);
}

export function applyDocumentTheme(themeOrId = 'stylized') {
  const theme = typeof themeOrId === 'string' ? getTheme(themeOrId) : themeOrId || STYLIZED;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme.id;
    document.documentElement.style.setProperty('--accent', theme.css.accent);
    document.documentElement.style.setProperty('--accent-2', theme.css.accent2);
    document.documentElement.style.setProperty('--danger', theme.css.danger);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.css.themeColor);
  }
  return theme;
}

export { STYLIZED, DEEP_SEA, TWILIGHT_GARDEN, BLUE_TRENCH, VOLCANIC_RIFT, LEVIATHAN_DEPTHS };
