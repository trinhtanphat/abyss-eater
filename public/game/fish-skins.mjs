function freezeSkin(id, body, fin, accent, emissive, roughnessOffset = 0, metalnessOffset = 0) {
  return Object.freeze({ id, body, fin, accent, emissive, roughnessOffset, metalnessOffset });
}

export const SKIN_FAMILIES = Object.freeze([
  freezeSkin('azure', 0x2c9ee8, 0x5bc9ff, 0x8af7ff, 0x145b86, -0.04, 0.03),
  freezeSkin('coral', 0xef6d7d, 0xff9b88, 0xffd39a, 0x7c2437, 0.02, 0),
  freezeSkin('toxic', 0x66bd35, 0xa6e650, 0xc9ff76, 0x315d17, 0.04, -0.01),
  freezeSkin('ember', 0xd6532e, 0xff8a3d, 0xffc85a, 0x7d2617, 0.06, 0.01),
  freezeSkin('aurora', 0x4abfd2, 0x966fe8, 0x87ffd2, 0x285b77, -0.05, 0.05),
  freezeSkin('void', 0x282941, 0x4a426e, 0x8374c9, 0x15152c, 0.12, 0.02),
  freezeSkin('royal', 0x6050c8, 0x8a68e8, 0xffcf61, 0x322769, -0.02, 0.08),
  freezeSkin('pearl', 0xc7d9da, 0xf0f5ef, 0x9fe9e4, 0x6a7d83, -0.1, 0.12),
  freezeSkin('tiger', 0xd9a23b, 0x412f24, 0xffda66, 0x684513, 0.08, 0),
  freezeSkin('koi', 0xf3eee4, 0xe15a46, 0xffb15b, 0x6b3933, -0.03, 0.04),
  freezeSkin('spectral', 0x7ad5c7, 0xa4f4db, 0xd7fff5, 0x3b7772, -0.14, 0.08),
  freezeSkin('leviathan', 0x1c4f5d, 0x16303f, 0x6ef1dd, 0x0c2b35, 0.16, 0.05),
]);

function hashString(value) {
  let hash = 2166136261;
  for (const ch of String(value || 'fish')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mixHex(a, b, amount) {
  const t = Math.max(0, Math.min(1, Number(amount) || 0));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (clampByte(ar + (br - ar) * t) << 16)
    | (clampByte(ag + (bg - ag) * t) << 8)
    | clampByte(ab + (bb - ab) * t);
}

export function skinFamilyForId(id) {
  return SKIN_FAMILIES[hashString(id) % SKIN_FAMILIES.length];
}

export function skinPaletteFor(id, theme) {
  const family = skinFamilyForId(id);
  const local = Number(theme?.fish?.local) || 0x66efff;
  const floor = Number(theme?.floor?.color) || 0x0a3f51;
  const darkTheme = Number(theme?.scene?.fogDensity) > 0.018;
  const themeBlend = darkTheme ? 0.18 : 0.1;
  return Object.freeze({
    id: family.id,
    body: mixHex(family.body, floor, themeBlend),
    fin: mixHex(family.fin, floor, themeBlend * 0.72),
    accent: mixHex(family.accent, local, 0.16),
    emissive: mixHex(family.emissive, local, darkTheme ? 0.2 : 0.1),
    roughnessOffset: family.roughnessOffset,
    metalnessOffset: family.metalnessOffset,
  });
}
