const SKIN_VISUALS = Object.freeze({
  reef: Object.freeze({ id: 'reef', bodyColor: '#5de7d7', accentColor: '#d9fff7', emissive: '#0f746f' }),
  azure: Object.freeze({ id: 'azure', bodyColor: '#4ca7ff', accentColor: '#d9efff', emissive: '#174f96' }),
  abyssal: Object.freeze({ id: 'abyssal', bodyColor: '#705dff', accentColor: '#e2ddff', emissive: '#34207f' }),
  sunset: Object.freeze({ id: 'sunset', bodyColor: '#ff8a5c', accentColor: '#fff0d7', emissive: '#8c3523' }),
});

export function skinVisual(id) {
  if (typeof id !== 'string') return null;
  const visual = SKIN_VISUALS[id];
  return visual ? { ...visual } : null;
}

export { SKIN_VISUALS };
