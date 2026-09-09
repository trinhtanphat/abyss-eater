const MUTE_STORAGE_KEY = 'abyss-eater-muted-players-v1';
const MAX_MUTED_PLAYERS = 32;

function boundedId(value) {
  const id = String(value ?? '').trim();
  return /^[A-Za-z0-9._:-]{1,128}$/.test(id) ? id : '';
}

export function normalizeMutedIds(value) {
  const source = Array.isArray(value) ? value : [];
  const result = [];
  const seen = new Set();
  for (const raw of source) {
    const id = boundedId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_MUTED_PLAYERS) break;
  }
  return result;
}

export function toggleMutedId(ids, rawId) {
  const current = normalizeMutedIds(ids);
  const id = boundedId(rawId);
  if (!id) return current;
  if (current.includes(id)) return current.filter((value) => value !== id);
  return normalizeMutedIds([...current, id]);
}
export function loadMutedIds(storage = globalThis.localStorage) {
  try {
    return normalizeMutedIds(JSON.parse(storage?.getItem?.(MUTE_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function saveMutedIds(ids, storage = globalThis.localStorage) {
  const normalized = normalizeMutedIds(ids);
  try { storage?.setItem?.(MUTE_STORAGE_KEY, JSON.stringify(normalized)); } catch {}
  return normalized;
}

export function createSocialClient({ fetchImpl = globalThis.fetch, getToken = () => '' } = {}) {
  async function request(path, { method = 'POST', body, authenticated = false } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('social_fetch_unavailable');
    const headers = { Accept: 'application/json' };
    if (authenticated) {
      const token = String(getToken?.() || '').trim();
      if (!token) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' });
      headers.Authorization = `Bearer ${token}`;
    }
    const init = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetchImpl(path, init);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      const error = new Error(payload?.code || `social_http_${response.status}`);
      error.code = payload?.code || 'request_failed';
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  return {
    quickDive: () => request('/api/matchmaking/quick'),
    partyCreate: () => request('/api/party/create', { authenticated: true }),
    partyJoin: (code) => request('/api/party/join', { body: { code: String(code || '') }, authenticated: true }),
    partyLeave: (code) => request('/api/party/leave', { body: { code: String(code || '') }, authenticated: true }),
    partyStatus: (code) => request(`/api/party/status?code=${encodeURIComponent(String(code || ''))}`, { method: 'GET', authenticated: true }),
    partyQuickDive: (code) => request('/api/party/quick', { body: { code: String(code || '') }, authenticated: true }),
    report: ({ targetPlayerId, room, reason = 'abuse' } = {}) => request('/api/report', {
      body: { targetPlayerId: boundedId(targetPlayerId), room: String(room || '').slice(0, 24), reason: String(reason || 'abuse') },
      authenticated: true,
    }),
  };
}

export { MUTE_STORAGE_KEY, MAX_MUTED_PLAYERS };