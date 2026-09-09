export const REGION_IDS = Object.freeze(['SEA', 'JP', 'EU', 'NA', 'OTHER']);
export const PUBLIC_ROOM_CAPACITY = 20;
export const PUBLIC_ROOM_TTL_MS = 60_000;
export const MAX_PARTY_SIZE = 4;

const SEA = new Set(['VN', 'TH', 'SG', 'MY', 'ID', 'PH', 'KH', 'LA', 'MM', 'BN', 'TL']);
const JP = new Set(['JP', 'KR', 'TW', 'HK', 'MO']);
const EU = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'GB', 'IS', 'LI', 'NO', 'CH',
]);
const NA = new Set(['US', 'CA', 'MX']);

export function regionForCountry(country) {
  const code = String(country || '').trim().toUpperCase();
  if (SEA.has(code)) return 'SEA';
  if (JP.has(code)) return 'JP';
  if (EU.has(code)) return 'EU';
  if (NA.has(code)) return 'NA';
  return 'OTHER';
}
export function canonicalRoomLabel(value, fallback = 'ocean-1') {
  const normalized = String(value ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const safeFallback = String(fallback || 'ocean-1').slice(0, 24).toLowerCase();
  return (normalized || safeFallback || 'ocean-1').slice(0, 24);
}

export function canonicalRegion(value) {
  const region = String(value || '').trim().toUpperCase();
  return REGION_IDS.includes(region) ? region : 'OTHER';
}

export function choosePublicRoom(records, region, partySize = 1, now = Date.now()) {
  const targetRegion = canonicalRegion(region);
  const requestedSize = Math.floor(Number(partySize) || 1);
  if (requestedSize < 1 || requestedSize > MAX_PARTY_SIZE) return null;
  const size = requestedSize;
  const timestamp = Number.isFinite(now) ? now : 0;
  const source = Array.isArray(records) ? records : [];
  const eligible = source.filter((record) => {
    const updatedAt = Number(record?.updatedAt);
    const players = Math.max(0, Math.floor(Number(record?.players) || 0));
    return canonicalRegion(record?.region) === targetRegion
      && typeof record?.room === 'string'
      && record.room.startsWith('public-')
      && Number.isFinite(updatedAt)
      && timestamp - updatedAt >= 0
      && timestamp - updatedAt <= PUBLIC_ROOM_TTL_MS
      && players + size <= PUBLIC_ROOM_CAPACITY;
  });
  eligible.sort((a, b) => {
    const playersA = Math.max(0, Math.floor(Number(a.players) || 0));
    const playersB = Math.max(0, Math.floor(Number(b.players) || 0));
    if (playersA !== playersB) return playersB - playersA;
    const updatedA = Number(a.updatedAt) || 0;
    const updatedB = Number(b.updatedAt) || 0;
    if (updatedA !== updatedB) return updatedA - updatedB;
    return String(a.room).localeCompare(String(b.room));
  });
  return eligible[0] ? { ...eligible[0] } : null;
}

export function publicRoomLabel(region, sequence) {
  const targetRegion = canonicalRegion(region).toLowerCase();
  const id = Math.max(1, Math.floor(Number(sequence) || 1)).toString(36);
  return `public-${targetRegion}-${id}`.slice(0, 24);
}

export function regionFromRoomLabel(room) {
  const match = /^public-(sea|jp|eu|na|other)-/i.exec(String(room || ''));
  return match ? canonicalRegion(match[1]) : null;
}
