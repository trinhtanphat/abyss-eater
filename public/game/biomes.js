export const BIOME_VISUAL_IDS = Object.freeze(['surface', 'reef', 'deep', 'abyss']);

const VISUALS = Object.freeze({
  surface: Object.freeze({ id: 'surface', label: 'Surface', fogScale: 0.72, ambientScale: 1.08 }),
  reef: Object.freeze({ id: 'reef', label: 'Reef', fogScale: 0.9, ambientScale: 1 }),
  deep: Object.freeze({ id: 'deep', label: 'Deep Ocean', fogScale: 1.22, ambientScale: 0.78 }),
  abyss: Object.freeze({ id: 'abyss', label: 'Abyss', fogScale: 1.55, ambientScale: 0.56 }),
});

export function biomeVisual(id) {
  return VISUALS[id] || VISUALS.reef;
}