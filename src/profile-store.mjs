import { levelForXp, rewardForSession, skinById } from './progression.mjs';

function canonicalProfileId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.length > 128) throw new Error('profile-id-invalid');
  return id;
}

function canonicalEventId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.length > 192) throw new Error('reward-event-invalid');
  return id;
}

function canonicalSeason(value) {
  const season = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!season || season.length > 32 || !/^[a-z0-9._-]+$/.test(season)) return 'all-time';
  return season;
}

function canonicalTime(value) {
  const time = Number(value);
  if (!Number.isSafeInteger(time) || time < 0) throw new Error('profile-time-invalid');
  return time;
}

function normalizeDisplayName(value) {
  const normalized = String(value ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || 'Little Fish').slice(0, 20);
}

function assertDb(db) {
  if (!db || typeof db.prepare !== 'function') throw new Error('profile-db-unavailable');
  return db;
}

function mapProfile(row) {
  if (!row || typeof row !== 'object') return null;
  const xp = Math.max(0, Number(row.xp ?? 0));
  return {
    id: String(row.id ?? ''),
    displayName: String(row.display_name ?? 'Little Fish'),
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
    xp,
    level: levelForXp(xp),
    pearls: Math.max(0, Number(row.pearls ?? 0)),
    selectedSkinId: String(row.selected_skin_id ?? 'reef'),
    bestMass: Math.max(1, Number(row.best_mass ?? 1)),
    bestScore: Math.max(0, Number(row.best_score ?? 0)),
    gamesPlayed: Math.max(0, Number(row.games_played ?? 0)),
    totalEaten: Math.max(0, Number(row.total_eaten ?? 0)),
    status: String(row.status ?? 'active'),
    sessionVersion: Math.max(1, Number(row.session_version ?? 1)),
  };
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export async function createGuestProfile(db, displayName, nowMs, profileId = crypto.randomUUID()) {
  assertDb(db);
  if (typeof db.batch !== 'function') throw new Error('profile-db-unavailable');
  const id = canonicalProfileId(profileId);
  const now = canonicalTime(nowMs);
  const name = normalizeDisplayName(displayName);
  const profile = {
    id,
    displayName: name,
    createdAt: now,
    updatedAt: now,
    xp: 0,
    level: 1,
    pearls: 0,
    selectedSkinId: 'reef',
    bestMass: 1,
    bestScore: 0,
    gamesPlayed: 0,
    totalEaten: 0,
    status: 'active',
    sessionVersion: 1,
  };

  const profileStatement = db.prepare(`
    INSERT INTO profiles (
      id, display_name, created_at, updated_at, xp, level, pearls,
      selected_skin_id, best_mass, best_score, games_played, total_eaten,
      status, session_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    profile.id,
    profile.displayName,
    profile.createdAt,
    profile.updatedAt,
    profile.xp,
    profile.level,
    profile.pearls,
    profile.selectedSkinId,
    profile.bestMass,
    profile.bestScore,
    profile.gamesPlayed,
    profile.totalEaten,
    profile.status,
    profile.sessionVersion,
  );
  const starterSkinStatement = db.prepare(`
    INSERT INTO profile_skins (profile_id, skin_id, unlocked_at)
    VALUES (?, ?, ?)
  `).bind(profile.id, 'reef', now);

  await db.batch([profileStatement, starterSkinStatement]);
  return profile;
}

export async function readProfile(db, profileId) {
  assertDb(db);
  const id = canonicalProfileId(profileId);
  const row = await db.prepare(`
    SELECT id, display_name, created_at, updated_at, xp, level, pearls,
           selected_skin_id, best_mass, best_score, games_played, total_eaten,
           status, session_version
    FROM profiles
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();
  return mapProfile(row);
}

export async function readOwnedSkins(db, profileId) {
  assertDb(db);
  const id = canonicalProfileId(profileId);
  const response = await db.prepare(`
    SELECT skin_id
    FROM profile_skins
    WHERE profile_id = ?
    ORDER BY skin_id ASC
  `).bind(id).all();
  const results = Array.isArray(response?.results) ? response.results : [];
  return [...new Set(results
    .map((row) => typeof row?.skin_id === 'string' ? row.skin_id.trim() : '')
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

export async function applySessionReward(db, profileId, eventId, summary = {}, nowMs = Date.now()) {
  assertDb(db);
  if (typeof db.batch !== 'function') throw new Error('profile-db-unavailable');
  const id = canonicalProfileId(profileId);
  const event = canonicalEventId(eventId);
  const now = canonicalTime(nowMs);
  const reward = rewardForSession(summary);
  const score = Math.floor(finiteNonNegative(summary?.score));
  const mass = Math.max(1, finiteNonNegative(summary?.mass) || 1);
  const eaten = Math.floor(finiteNonNegative(summary?.eaten));
  const season = 'all-time';

  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO reward_events
      (id, profile_id, xp, pearls, score, mass, eaten, season, applied, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).bind(event, id, reward.xp, reward.pearls, score, mass, eaten, season, now);

  const updateProfile = db.prepare(`
    UPDATE profiles
    SET xp = xp + ?,
        pearls = pearls + ?,
        best_score = MAX(best_score, ?),
        best_mass = MAX(best_mass, ?),
        games_played = games_played + 1,
        total_eaten = total_eaten + ?,
        updated_at = ?
    WHERE id = ?
      AND EXISTS (
        SELECT 1 FROM reward_events
        WHERE id = ? AND profile_id = ? AND applied = 0
      )
  `).bind(reward.xp, reward.pearls, score, mass, eaten, now, id, event, id);

  const upsertLeaderboard = db.prepare(`
    INSERT INTO leaderboard_entries (profile_id, season, best_score, best_mass, updated_at)
    SELECT ?, ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1 FROM reward_events
      WHERE id = ? AND profile_id = ? AND applied = 0
    )
    ON CONFLICT(profile_id, season) DO UPDATE SET
      best_score = MAX(leaderboard_entries.best_score, excluded.best_score),
      best_mass = MAX(leaderboard_entries.best_mass, excluded.best_mass),
      updated_at = excluded.updated_at
  `).bind(id, season, score, mass, now, event, id);

  const markApplied = db.prepare(`
    UPDATE reward_events
    SET applied = 1
    WHERE id = ? AND profile_id = ? AND applied = 0
  `).bind(event, id);

  const results = await db.batch([insertEvent, updateProfile, upsertLeaderboard, markApplied]);
  const changes = Number(results?.[1]?.meta?.changes ?? 0);
  return { applied: changes > 0, reward };
}

export async function readLeaderboard(db, season = 'all-time', limit = 10) {
  assertDb(db);
  const normalizedSeason = canonicalSeason(season);
  const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 10)));
  const response = await db.prepare(`
    SELECT l.profile_id, p.display_name, l.best_score, l.best_mass, l.updated_at
    FROM leaderboard_entries l
    JOIN profiles p ON p.id = l.profile_id
    WHERE l.season = ? AND p.status = 'active'
    ORDER BY l.best_score DESC, l.best_mass DESC, l.updated_at ASC, l.profile_id ASC
    LIMIT ?
  `).bind(normalizedSeason, normalizedLimit).all();
  const rows = Array.isArray(response?.results) ? response.results : [];
  return rows.map((row) => ({
    profileId: String(row.profile_id ?? ''),
    displayName: String(row.display_name ?? 'Little Fish'),
    bestScore: Math.max(0, Number(row.best_score ?? 0)),
    bestMass: Math.max(1, Number(row.best_mass ?? 1)),
    updatedAt: Number(row.updated_at ?? 0),
  }));
}


function xpRequiredForLevel(value) {
  const level = Math.max(1, Math.floor(Number(value) || 1));
  return 100 * (level - 1) * level / 2;
}

export async function purchaseSkin(db, profileId, skinId, nowMs = Date.now()) {
  assertDb(db);
  if (typeof db.batch !== 'function') throw new Error('profile-db-unavailable');
  const id = canonicalProfileId(profileId);
  const now = canonicalTime(nowMs);
  const skin = skinById(skinId);
  if (!skin) return { ok: false, code: 'unknown_skin' };
  if (skin.id === 'reef') return { ok: false, code: 'already_owned' };

  const profile = await readProfile(db, id);
  if (!profile || profile.status !== 'active') return { ok: false, code: 'profile_unavailable' };
  const owned = await readOwnedSkins(db, id);
  if (owned.includes(skin.id)) return { ok: false, code: 'already_owned' };
  if (profile.level < skin.unlockLevel) return { ok: false, code: 'locked' };
  if (profile.pearls < skin.price) return { ok: false, code: 'insufficient_pearls' };

  const requiredXp = xpRequiredForLevel(skin.unlockLevel);
  const debit = db.prepare(`
    UPDATE profiles
    SET pearls = pearls - ?, updated_at = ?
    WHERE id = ?
      AND pearls >= ?
      AND xp >= ?
      AND NOT EXISTS (
        SELECT 1 FROM profile_skins
        WHERE profile_id = ? AND skin_id = ?
      )
  `).bind(skin.price, now, id, skin.price, requiredXp, id, skin.id);
  const unlock = db.prepare(`
    INSERT OR IGNORE INTO profile_skins (profile_id, skin_id, unlocked_at)
    SELECT ?, ?, ?
    WHERE changes() = 1
  `).bind(id, skin.id, now);

  const results = await db.batch([debit, unlock]);
  if (Number(results?.[0]?.meta?.changes ?? 0) !== 1) return { ok: false, code: 'purchase_conflict' };
  return { ok: true, skinId: skin.id, price: skin.price };
}

export async function selectSkin(db, profileId, skinId, nowMs = Date.now()) {
  assertDb(db);
  const id = canonicalProfileId(profileId);
  const now = canonicalTime(nowMs);
  const skin = skinById(skinId);
  if (!skin) return { ok: false, code: 'unknown_skin' };

  const profile = await readProfile(db, id);
  if (!profile || profile.status !== 'active') return { ok: false, code: 'profile_unavailable' };
  const owned = await readOwnedSkins(db, id);
  if (!owned.includes(skin.id)) return { ok: false, code: 'not_owned' };
  if (profile.selectedSkinId === skin.id) return { ok: true, skinId: skin.id };

  const result = await db.prepare(`
    UPDATE profiles
    SET selected_skin_id = ?, updated_at = ?
    WHERE id = ?
      AND EXISTS (
        SELECT 1 FROM profile_skins
        WHERE profile_id = ? AND skin_id = ?
      )
  `).bind(skin.id, now, id, id, skin.id).run();
  if (Number(result?.meta?.changes ?? 0) !== 1) return { ok: false, code: 'select_conflict' };
  return { ok: true, skinId: skin.id };
}
