const STYLIZED = Object.freeze({
  id: 'stylized',
  label: 'Sunken Reef',
  scene: Object.freeze({ background: 0x031827, fog: 0x062434, fogDensity: 0.0115 }),
  lighting: Object.freeze({ sky: 0x91f3ff, ground: 0x011420, hemi: 1.25, sun: 0xb9f6ff, sunIntensity: 1.35, accent: 0x2bd7de, accentIntensity: 0.8 }),
  floor: Object.freeze({ color: 0x0a3f51, roughness: 0.96, emissive: 0x021419, emissiveIntensity: 0.15 }),
  water: Object.freeze({ bubble: 0x9af4ff, plankton: 0x7ff6d7, shaft: 0x89edff }),
  decor: Object.freeze({ rock: 0x164858, kelp: 0x1b826f, coral: 0xff8d9f, coralAlt: 0xffc66b, accent: 0x55d6c2, accentAlt: 0xff7b9b }),
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
  decor: Object.freeze({ rock: 0x101b1c, kelp: 0x173e37, coral: 0x5c4544, coralAlt: 0x665b42, accent: 0x8f8268, accentAlt: 0x6f7770 }),
  food: Object.freeze({ color: 0xa5d9ca, emissive: 0x356e60, emissiveIntensity: 0.92 }),
  fish: Object.freeze({ local: 0x8bc0c5, saturation: 0.46, lightness: 0.44, roughness: 0.72, metalness: 0.015, emissiveBoost: 0.06, eye: 0xd7d9cf, pupil: 0x020504 }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.17, planktonOpacity: 0.33, bubbleSize: 0.105, planktonSize: 0.052, shaftOpacity: 0.014, shaftWidth: 0.62, ringOpacity: 0.012, drift: 0.011, sway: 0.62 }),
  css: Object.freeze({ accent: '#8bc0c5', accent2: '#9fcdbd', danger: '#e37984', themeColor: '#01070c' }),
});

const TWILIGHT_GARDEN = Object.freeze({
  id: 'twilight-garden',
  label: 'Twilight Garden',
  scene: Object.freeze({ background: 0x090d2b, fog: 0x11163c, fogDensity: 0.0145 }),
  lighting: Object.freeze({ sky: 0x8ba7ff, ground: 0x080718, hemi: 1.05, sun: 0xa7bcff, sunIntensity: 1.05, accent: 0x8b68ff, accentIntensity: 0.72 }),
  floor: Object.freeze({ color: 0x112c3d, roughness: 0.93, emissive: 0x09142a, emissiveIntensity: 0.11 }),
  water: Object.freeze({ bubble: 0x9fc7ff, plankton: 0xb487ff, shaft: 0x739dff }),
  decor: Object.freeze({ rock: 0x252c4b, kelp: 0x285d66, coral: 0xb873ff, coralAlt: 0x59d8cf, accent: 0x7c65d8, accentAlt: 0x74efd4 }),
  food: Object.freeze({ color: 0xcbb4ff, emissive: 0x7655db, emissiveIntensity: 1.55 }),
  fish: Object.freeze({ local: 0x72eaff, saturation: 0.68, lightness: 0.56, roughness: 0.42, metalness: 0.07, emissiveBoost: 0.23, eye: 0xf2ecff, pupil: 0x09051c }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.27, planktonOpacity: 0.5, bubbleSize: 0.135, planktonSize: 0.083, shaftOpacity: 0.026, shaftWidth: 0.82, ringOpacity: 0.026, drift: 0.014, sway: 0.9 }),
  css: Object.freeze({ accent: '#72eaff', accent2: '#b98cff', danger: '#ff7eb2', themeColor: '#090d2b' }),
});

const BLUE_TRENCH = Object.freeze({
  id: 'blue-trench',
  label: 'Blue Trench',
  scene: Object.freeze({ background: 0x020b14, fog: 0x061724, fogDensity: 0.0175 }),
  lighting: Object.freeze({ sky: 0x5d9fc4, ground: 0x01050a, hemi: 0.82, sun: 0x78bed9, sunIntensity: 0.72, accent: 0x1a8ea9, accentIntensity: 0.4 }),
  floor: Object.freeze({ color: 0x0a2028, roughness: 0.99, emissive: 0x031015, emissiveIntensity: 0.06 }),
  water: Object.freeze({ bubble: 0x72bbd5, plankton: 0x52a9a9, shaft: 0x397e9d }),
  decor: Object.freeze({ rock: 0x17262d, kelp: 0x194b50, coral: 0x346a73, coralAlt: 0x516e78, accent: 0x2b7e8e, accentAlt: 0x6b91a0 }),
  food: Object.freeze({ color: 0x85d8d0, emissive: 0x236e72, emissiveIntensity: 1.1 }),
  fish: Object.freeze({ local: 0x73d9ef, saturation: 0.56, lightness: 0.48, roughness: 0.6, metalness: 0.035, emissiveBoost: 0.11, eye: 0xd9f4f7, pupil: 0x021014 }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.2, planktonOpacity: 0.29, bubbleSize: 0.112, planktonSize: 0.056, shaftOpacity: 0.018, shaftWidth: 0.68, ringOpacity: 0.016, drift: 0.012, sway: 0.7 }),
  css: Object.freeze({ accent: '#73d9ef', accent2: '#7fdac9', danger: '#ef7893', themeColor: '#020b14' }),
});

const VOLCANIC_RIFT = Object.freeze({
  id: 'volcanic-rift',
  label: 'Volcanic Rift',
  scene: Object.freeze({ background: 0x090706, fog: 0x160b08, fogDensity: 0.016 }),
  lighting: Object.freeze({ sky: 0x9c694f, ground: 0x050201, hemi: 0.82, sun: 0xd89b6b, sunIntensity: 0.82, accent: 0xff6a24, accentIntensity: 0.88 }),
  floor: Object.freeze({ color: 0x1a1715, roughness: 1, emissive: 0x250b03, emissiveIntensity: 0.14 }),
  water: Object.freeze({ bubble: 0xb79583, plankton: 0xff9a52, shaft: 0xb8542e }),
  decor: Object.freeze({ rock: 0x23201f, kelp: 0x43352f, coral: 0x8c3c26, coralAlt: 0x9f6434, accent: 0xe25220, accentAlt: 0xffa147 }),
  food: Object.freeze({ color: 0xffbd72, emissive: 0xe24d17, emissiveIntensity: 1.72 }),
  fish: Object.freeze({ local: 0x6eefff, saturation: 0.64, lightness: 0.5, roughness: 0.5, metalness: 0.06, emissiveBoost: 0.17, eye: 0xffe5c8, pupil: 0x1a0500 }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.22, planktonOpacity: 0.48, bubbleSize: 0.12, planktonSize: 0.07, shaftOpacity: 0.022, shaftWidth: 0.72, ringOpacity: 0.022, drift: 0.015, sway: 0.76 }),
  css: Object.freeze({ accent: '#78eaff', accent2: '#ff9c55', danger: '#ff5c4b', themeColor: '#090706' }),
});

const LEVIATHAN_DEPTHS = Object.freeze({
  id: 'leviathan-depths',
  label: 'Leviathan Depths',
  scene: Object.freeze({ background: 0x010308, fog: 0x050914, fogDensity: 0.021 }),
  lighting: Object.freeze({ sky: 0x315274, ground: 0x000103, hemi: 0.58, sun: 0x4f7395, sunIntensity: 0.48, accent: 0x684cff, accentIntensity: 0.58 }),
  floor: Object.freeze({ color: 0x070b11, roughness: 1, emissive: 0x050618, emissiveIntensity: 0.07 }),
  water: Object.freeze({ bubble: 0x546d84, plankton: 0x5c6fff, shaft: 0x33455f }),
  decor: Object.freeze({ rock: 0x0e1218, kelp: 0x15252d, coral: 0x2f3657, coralAlt: 0x3a305d, accent: 0x4d54a8, accentAlt: 0x2eb9c2 }),
  food: Object.freeze({ color: 0x8fa6ff, emissive: 0x493ce0, emissiveIntensity: 1.35 }),
  fish: Object.freeze({ local: 0x67f4ff, saturation: 0.5, lightness: 0.43, roughness: 0.66, metalness: 0.025, emissiveBoost: 0.12, eye: 0xbfd7ff, pupil: 0x000107 }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.13, planktonOpacity: 0.37, bubbleSize: 0.095, planktonSize: 0.05, shaftOpacity: 0.009, shaftWidth: 0.5, ringOpacity: 0.011, drift: 0.009, sway: 0.52 }),
  css: Object.freeze({ accent: '#67f4ff', accent2: '#8774ff', danger: '#ff668f', themeColor: '#010308' }),
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
