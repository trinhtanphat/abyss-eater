const THEMES = new Set(['stylized', 'deep-sea']);
const QUALITIES = new Set(['auto', 'high', 'medium', 'low']);

function normalizedToken(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeTheme(value) {
  const token = normalizedToken(value);
  return THEMES.has(token) ? token : 'stylized';
}

export function normalizeQuality(value) {
  const token = normalizedToken(value);
  return QUALITIES.has(token) ? token : 'auto';
}

export function growthProgress(mass) {
  const value = Number(mass);
  if (!Number.isFinite(value) || value <= 1) return 0;
  if (value >= 64) return 1;
  return Math.max(0, Math.min(1, Math.log2(value) / 6));
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function shortId(id) {
  const value = String(id || 'fish');
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

export function leaderboard(players, clientId, limit = 5) {
  const max = Math.max(1, Math.min(10, Math.trunc(numeric(limit, 5))));
  return [...(Array.isArray(players) ? players : [])]
    .sort((a, b) => numeric(b?.score) - numeric(a?.score) || numeric(b?.mass) - numeric(a?.mass) || String(a?.id).localeCompare(String(b?.id)))
    .slice(0, max)
    .map((player, index) => ({
      id: String(player?.id ?? ''),
      name: String(player?.name || shortId(player?.id)),
      score: numeric(player?.score),
      mass: Math.max(0, numeric(player?.mass, 1)),
      rank: index + 1,
      isLocal: String(player?.id ?? '') === String(clientId ?? ''),
    }));
}

export function ecosystemSummary(entities, clientId) {
  const list = Array.isArray(entities) ? entities : [];
  const me = list.find((entity) => String(entity?.id) === String(clientId));
  if (!me) return { prey: 0, threats: 0 };
  const myMass = Math.max(0.2, numeric(me.mass, 1));
  let prey = 0;
  let threats = 0;
  for (const entity of list) {
    if (!entity || String(entity.id) === String(clientId)) continue;
    const mass = numeric(entity.mass, 0);
    if (mass < 0.2) continue;
    if (myMass >= mass * 1.15) prey += 1;
    else if (mass >= myMass * 1.15) threats += 1;
  }
  return { prey, threats };
}

function positionOf(player) {
  const position = player?.position || {};
  return {
    x: numeric(position.x),
    y: numeric(position.y),
    z: numeric(position.z),
  };
}

export function dangerLevel(players, clientId, radius = 26) {
  const list = Array.isArray(players) ? players : [];
  const me = list.find((player) => String(player?.id) === String(clientId));
  if (!me) return { level: 'safe', threat: null };

  const origin = positionOf(me);
  const myMass = Math.max(0.01, numeric(me.mass, 1));
  const maxDistance = Math.max(1, numeric(radius, 26));
  let nearest = null;

  for (const player of list) {
    if (!player || String(player.id) === String(clientId)) continue;
    const threatMass = numeric(player.mass, 1);
    if (threatMass < myMass * 1.35) continue;
    const position = positionOf(player);
    const distance = Math.hypot(position.x - origin.x, position.y - origin.y, position.z - origin.z);
    if (distance > maxDistance) continue;
    if (!nearest || distance < nearest.distance) {
      nearest = {
        id: String(player.id ?? ''),
        name: String(player.name || shortId(player.id)),
        mass: threatMass,
        distance,
      };
    }
  }

  if (!nearest) return { level: 'safe', threat: null };
  return {
    level: nearest.mass >= myMass * 2.25 || nearest.distance <= maxDistance * 0.35 ? 'danger' : 'warning',
    threat: nearest,
  };
}

export function normalizePlanarInput(input = {}) {
  let x = numeric(input.x);
  let z = numeric(input.z);
  const length = Math.hypot(x, z);
  if (length > 1) {
    x /= length;
    z /= length;
  }
  return { x, z };
}
