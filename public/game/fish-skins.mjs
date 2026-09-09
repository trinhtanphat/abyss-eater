const RAW_FAMILIES = [
  ['azure', 0x3fa9f5, 0x7ddfff, 0xb8f6ff, 0x267da8, -0.06, 0.03],
  ['coral', 0xff6f91, 0xffa572, 0xffd2a1, 0xc93d67, 0.02, -0.01],
  ['toxic', 0x6bdc63, 0xc4ff5d, 0xeaff9a, 0x48b83f, -0.04, 0.01],
  ['ember', 0xe85c32, 0xffa141, 0xffd16b, 0xa83422, 0.04, 0.02],
  ['aurora', 0x5ce3d7, 0x8072ff, 0xb68cff, 0x43b5c5, -0.07, 0.04],
  ['void', 0x252842, 0x5b4678, 0x8b66b8, 0x16182f, 0.09, 0.05],
  ['royal', 0x3a4fd6, 0xd29b46, 0xffd977, 0x263593, 0.01, 0.07],
  ['pearl', 0xd9eef0, 0xf5d9ef, 0xffffff, 0x9bcad1, -0.1, 0.08],
  ['tiger', 0xe6a13d, 0x3c3936, 0xffc15d, 0x9f641e, 0.08, -0.02],
  ['koi', 0xf0eee7, 0xe65443, 0xff9c7e, 0x9a342b, 0.02, 0.01],
  ['spectral', 0x79d9cf, 0xc4d7ff, 0xf0f7ff, 0x5b8fb6, -0.12, 0.03],
  ['leviathan', 0x17394a, 0x2c8896, 0x55f4ff, 0x0c2638, 0.12, 0.09],
];

export const SKIN_FAMILIES = Object.freeze(RAW_FAMILIES.map(([id, body, fin, accent, emissive, roughnessOffset, metalnessOffset]) => Object.freeze({
  id,
  body,
  fin,
  accent,
  emissive,
  roughnessOffset,
  metalnessOffset,
})));

function stableHash(value) {
  let hash = 2166136261;
  for (const ch of String(value ?? 'fish')) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function rgb(hex) {
  return [(hex >>> 16) & 0xff, (hex >>> 8) & 0xff, hex & 0xff];
}

function mixHex(a, b, weight = 0.2) {
  const t = Math.max(0, Math.min(1, Number(weight) || 0));
  const [ar, ag, ab] = rgb(a >>> 0);
  const [br, bg, bb] = rgb(b >>> 0);
  const channel = (x, y) => Math.max(0, Math.min(255, Math.round(x + (y - x) * t)));
  return (channel(ar, br) << 16) | (channel(ag, bg) << 8) | channel(ab, bb);
}

function boundedOffset(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(min, Math.min(max, number));
}

export function skinFamilyForId(id) {
  return SKIN_FAMILIES[stableHash(id) % SKIN_FAMILIES.length];
}

export function skinPaletteFor(id, theme = {}) {
  const family = skinFamilyForId(id);
  const ambient = Number.isInteger(theme?.water?.plankton) ? theme.water.plankton : 0x66dce8;
  const coral = Number.isInteger(theme?.decor?.coral) ? theme.decor.coral : ambient;
  const local = Number.isInteger(theme?.fish?.local) ? theme.fish.local : ambient;
  return Object.freeze({
    body: mixHex(family.body, ambient, 0.14),
    fin: mixHex(family.fin, coral, 0.12),
    accent: mixHex(family.accent, local, 0.16),
    emissive: mixHex(family.emissive, ambient, 0.12),
    roughnessOffset: boundedOffset(family.roughnessOffset, -0.2, 0.2),
    metalnessOffset: boundedOffset(family.metalnessOffset, -0.1, 0.12),
  });
}
