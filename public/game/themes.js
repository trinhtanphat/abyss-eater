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
  css: Object.freeze({ accent: '#66efff', accent2: '#8dffd8', danger: '#ff708d' }),
});

const THEMES = Object.freeze({ stylized: STYLIZED });

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
  }
  return theme;
}

export { STYLIZED };
