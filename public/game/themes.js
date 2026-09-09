const STYLIZED = Object.freeze({
  id: 'stylized',
  label: 'Stylized',
  scene: Object.freeze({ background: 0x031827, fog: 0x062434, fogDensity: 0.0115 }),
  lighting: Object.freeze({ sky: 0x91f3ff, ground: 0x011420, hemi: 1.25, sun: 0xb9f6ff, sunIntensity: 1.35, accent: 0x2bd7de, accentIntensity: 0.8 }),
  floor: Object.freeze({ color: 0x0a3f51, roughness: 0.96, emissive: 0x021419, emissiveIntensity: 0.15 }),
  water: Object.freeze({ bubble: 0x9af4ff, plankton: 0x7ff6d7, shaft: 0x89edff }),
  decor: Object.freeze({ rock: 0x164858, kelp: 0x1b826f, coral: 0xff8d9f, coralAlt: 0xffc66b }),
  food: Object.freeze({ color: 0x92ffe0, emissive: 0x1bbf92, emissiveIntensity: 1.9 }),
  fish: Object.freeze({ local: 0x66efff, saturation: 0.72, lightness: 0.58, roughness: 0.38, metalness: 0.08, emissiveBoost: 0.28, eye: 0xf4feff, pupil: 0x00131b }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.34, planktonOpacity: 0.42, bubbleSize: 0.16, planktonSize: 0.09, shaftOpacity: 0.035, shaftWidth: 1, ringOpacity: 0.035, drift: 0.018, sway: 1 }),
  css: Object.freeze({ accent: '#66efff', accent2: '#8dffd8', danger: '#ff708d', themeColor: '#031827' }),
});

const DEEP_SEA = Object.freeze({
  id: 'deep-sea',
  label: 'Deep Sea',
  scene: Object.freeze({ background: 0x01070c, fog: 0x031217, fogDensity: 0.0195 }),
  lighting: Object.freeze({ sky: 0x406b72, ground: 0x000406, hemi: 0.7, sun: 0x739aa0, sunIntensity: 0.68, accent: 0x1c6d68, accentIntensity: 0.32 }),
  floor: Object.freeze({ color: 0x071517, roughness: 1, emissive: 0x010506, emissiveIntensity: 0.04 }),
  water: Object.freeze({ bubble: 0x769fa5, plankton: 0x7cb7a3, shaft: 0x527a7d }),
  decor: Object.freeze({ rock: 0x101b1c, kelp: 0x173e37, coral: 0x5c4544, coralAlt: 0x665b42 }),
  food: Object.freeze({ color: 0xa5d9ca, emissive: 0x356e60, emissiveIntensity: 0.92 }),
  fish: Object.freeze({ local: 0x8bc0c5, saturation: 0.46, lightness: 0.44, roughness: 0.72, metalness: 0.015, emissiveBoost: 0.06, eye: 0xd7d9cf, pupil: 0x020504 }),
  atmosphere: Object.freeze({ bubbleOpacity: 0.17, planktonOpacity: 0.33, bubbleSize: 0.105, planktonSize: 0.052, shaftOpacity: 0.014, shaftWidth: 0.62, ringOpacity: 0.012, drift: 0.011, sway: 0.62 }),
  css: Object.freeze({ accent: '#8bc0c5', accent2: '#9fcdbd', danger: '#e37984', themeColor: '#01070c' }),
});

const THEMES = Object.freeze({
  stylized: STYLIZED,
  'deep-sea': DEEP_SEA,
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

export { STYLIZED, DEEP_SEA };
