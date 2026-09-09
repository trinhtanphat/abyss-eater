const SESSION_STORAGE_KEY = 'abyss-eater-session-v1';

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function safeLevel(value) {
  return Math.max(1, Math.floor(Number(value) || 1));
}

function thresholdForLevel(level) {
  const normalized = safeLevel(level);
  return 100 * (normalized - 1) * normalized / 2;
}

function safeToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (token.length < 3 || token.length > 4096) return '';
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ? token : '';
}

export function profileProgress(profile = {}) {
  const level = safeLevel(profile?.level);
  const xp = Math.floor(finiteNonNegative(profile?.xp));
  const currentXp = thresholdForLevel(level);
  const nextXp = thresholdForLevel(level + 1);
  const span = Math.max(1, nextXp - currentXp);
  const progress = Math.max(0, Math.min(1, (xp - currentXp) / span));
  return { level, xp, currentXp, nextXp, progress };
}

export function skinAction(skin, profile = {}, ownedIds = []) {
  if (!skin || typeof skin.id !== 'string') return 'unavailable';
  const owned = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  if (owned.has(skin.id)) return profile?.selectedSkinId === skin.id ? 'selected' : 'select';
  if (safeLevel(profile?.level) < safeLevel(skin.unlockLevel)) return 'locked';
  if (finiteNonNegative(profile?.pearls) < finiteNonNegative(skin.price)) return 'insufficient';
  return 'buy';
}

export function createProgressionClient({ fetchImpl = globalThis.fetch, storage = globalThis.localStorage } = {}) {
  let token = '';
  let profile = null;
  let ownedSkins = [];
  let catalog = [];
  let leaderboard = [];

  try { token = safeToken(storage?.getItem?.(SESSION_STORAGE_KEY)); } catch {}

  function persistToken(value) {
    token = safeToken(value);
    try {
      if (token) storage?.setItem?.(SESSION_STORAGE_KEY, token);
      else storage?.removeItem?.(SESSION_STORAGE_KEY);
    } catch {}
  }

  function applyPayload(payload = {}) {
    if (payload.token !== undefined) persistToken(payload.token);
    if (payload.profile && typeof payload.profile === 'object') profile = { ...payload.profile };
    if (Array.isArray(payload.ownedSkins)) ownedSkins = [...new Set(payload.ownedSkins.filter((id) => typeof id === 'string'))];
    if (Array.isArray(payload.catalog)) catalog = payload.catalog.map((skin) => ({ ...skin }));
    if (Array.isArray(payload.leaderboard)) leaderboard = payload.leaderboard.map((row) => ({ ...row }));
    return payload;
  }

  async function request(path, { method = 'GET', body, authenticated = false } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('progression_fetch_unavailable');
    const headers = { Accept: 'application/json' };
    if (authenticated && token) headers.Authorization = `Bearer ${token}`;
    const init = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetchImpl(path, init);
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok || payload?.ok === false) {
      if (response.status === 401) persistToken('');
      const error = new Error(payload?.code || `progression_http_${response.status}`);
      error.code = payload?.code || 'request_failed';
      error.status = response.status;
      throw error;
    }
    return applyPayload(payload);
  }

  async function ensureSession(displayName) {
    return request('/api/session', { method: 'POST', body: { displayName: String(displayName || '').slice(0, 20) }, authenticated: true });
  }

  async function refreshProfile() {
    if (!token) return null;
    return request('/api/profile', { authenticated: true });
  }

  async function refreshLeaderboard(limit = 8) {
    const bounded = Math.min(20, Math.max(1, Math.floor(Number(limit) || 8)));
    return request(`/api/leaderboard?limit=${bounded}`);
  }

  async function purchaseSkin(skinId) {
    if (!token) throw new Error('unauthorized');
    return request('/api/shop/purchase', { method: 'POST', body: { skinId: String(skinId || '') }, authenticated: true });
  }

  async function selectSkin(skinId) {
    if (!token) throw new Error('unauthorized');
    return request('/api/profile/skin', { method: 'POST', body: { skinId: String(skinId || '') }, authenticated: true });
  }

  return {
    ensureSession,
    refreshProfile,
    refreshLeaderboard,
    purchaseSkin,
    selectSkin,
    clearSession: () => persistToken(''),
    snapshot: () => ({
      token,
      profile: profile ? { ...profile } : null,
      ownedSkins: [...ownedSkins],
      catalog: catalog.map((skin) => ({ ...skin })),
      leaderboard: leaderboard.map((row) => ({ ...row })),
    }),
    get token() { return token; },
    get profile() { return profile ? { ...profile } : null; },
    get ownedSkins() { return [...ownedSkins]; },
    get catalog() { return catalog.map((skin) => ({ ...skin })); },
    get leaderboard() { return leaderboard.map((row) => ({ ...row })); },
  };
}

export { SESSION_STORAGE_KEY };
