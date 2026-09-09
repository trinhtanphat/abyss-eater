import { levelForXp, rewardForSession, seasonForTimestamp, skinById } from './progression.mjs';

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

function xpRequiredForLevel(level) {
  const normalized = Math.max(1, Math.floor(Number(level) || 1));
  return 100 * (normalized - 1) * normalized / 2;
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

export async function purchaseSkin(db, profileId, skinId, nowMs = Date.now()) {
  assertDb(db);
  if (typeof db.batch !== 'function') throw new Error('profile-db-unavailable');
  const id = canonicalProfileId(profileId);
  const skin = skinById(typeof skinId === 'string' ? skinId.trim() : '');
  if (!skin) return { ok: false, code: 'unknown_skin' };

  const profile = await readProfile(db, id);
  if (!profile || profile.status !== 'active') return { ok: false, code: 'profile_not_found' };
  const ownedSkins = await readOwnedSkins(db, id);
  if (ownedSkins.includes(skin.id)) return { ok: false, code: 'already_owned' };
  if (profile.level < skin.unlockLevel) return { ok: false, code: 'locked' };
  if (profile.pearls < skin.price) return { ok: false, code: 'insufficient_pearls' };
  if (skin.price <= 0) return { ok: false, code: 'already_owned' };

  const now = canonicalTime(nowMs);
  const unlockXp = xpRequiredForLevel(skin.unlockLevel);
  const debit = db.prepare(`
    UPDATE profiles
    SET pearls = pearls - ?, updated_at = ?
    WHERE id = ?
      AND status = 'active'
      AND pearls >= ?
      AND xp >= ?
      AND NOT EXISTS (
        SELECT 1 FROM profile_skins
        WHERE profile_id = ? AND skin_id = ?
      )
  `).bind(skin.price, now, id, skin.price, unlockXp, id, skin.id);
  const unlock = db.prepare(`
    INSERT OR IGNORE INTO profile_skins (profile_id, skin_id, unlocked_at)
    SELECT ?, ?, ?
    WHERE changes() = 1
  `).bind(id, skin.id, now);
  const results = await db.batch([debit, unlock]);
  if (Number(results?.[0]?.meta?.changes ?? 0) <= 0) return { ok: false, code: 'purchase_conflict' };
  return { ok: true, skinId: skin.id, price: skin.price };
}

export async function selectSkin(db, profileId, skinId, nowMs = Date.now()) {
  assertDb(db);
  const id = canonicalProfileId(profileId);
  const skin = skinById(typeof skinId === 'string' ? skinId.trim() : '');
  if (!skin) return { ok: false, code: 'unknown_skin' };
  const profile = await readProfile(db, id);
  if (!profile || profile.status !== 'active') return { ok: false, code: 'profile_not_found' };
  if (profile.selectedSkinId === skin.id) return { ok: true, skinId: skin.id };
  const ownedSkins = await readOwnedSkins(db, id);
  if (!ownedSkins.includes(skin.id)) return { ok: false, code: 'not_owned' };

  const now = canonicalTime(nowMs);
  const result = await db.prepare(`
    UPDATE profiles
    SET selected_skin_id = ?, updated_at = ?
    WHERE id = ? AND status = 'active'
      AND EXISTS (
        SELECT 1 FROM profile_skins
        WHERE profile_id = ? AND skin_id = ?
      )
  `).bind(skin.id, now, id, id, skin.id).run();
  if (Number(result?.meta?.changes ?? 0) <= 0) return { ok: false, code: 'not_owned' };
  return { ok: true, skinId: skin.id };
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
  const season = seasonForTimestamp(now);
  const allTime = 'all-time';

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

  const leaderboardSql = `
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
  `;
  const upsertAllTime = db.prepare(leaderboardSql).bind(id, allTime, score, mass, now, event, id);
  const upsertSeasonal = db.prepare(leaderboardSql).bind(id, season, score, mass, now, event, id);

  const markApplied = db.prepare(`
    UPDATE reward_events
    SET applied = 1
    WHERE id = ? AND profile_id = ? AND applied = 0
  `).bind(event, id);

  const results = await db.batch([insertEvent, updateProfile, upsertAllTime, upsertSeasonal, markApplied]);
  const changes = Number(results?.[1]?.meta?.changes ?? 0);
  return { applied: changes > 0, reward };
}

export async function readLeaderboard(db, season = 'all-time', limit = 10, nowMs = Date.now()) {
  assertDb(db);
  const normalizedSeason = String(season).toLowerCase() === 'seasonal'
    ? seasonForTimestamp(nowMs)
    : canonicalSeason(season);
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

function canonicalSessionId(value) {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('session-id-invalid');
  return id;
}

function canonicalSessionVersion(value) {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('session-version-invalid');
  return version;
}

export async function createSession(db, input = {}) {
  assertDb(db);
  const sessionId = canonicalSessionId(input.sessionId);
  const profileId = canonicalProfileId(input.profileId);
  const createdAt = canonicalTime(input.createdAt);
  const expiresAt = canonicalTime(input.expiresAt);
  const sessionVersion = canonicalSessionVersion(input.sessionVersion);
  if (expiresAt <= createdAt) throw new Error('session-expiry-invalid');
  const result = await db.prepare(`
    INSERT INTO sessions (session_id, profile_id, created_at, expires_at, session_version)
    VALUES (?, ?, ?, ?, ?)
  `).bind(sessionId, profileId, createdAt, expiresAt, sessionVersion).run();
  if (result?.success === false) throw new Error('session-create-failed');
  return { sessionId, profileId, createdAt, expiresAt, sessionVersion };
}

export async function profileForSession(db, sessionId, nowMs = Date.now()) {
  assertDb(db);
  const id = canonicalSessionId(sessionId);
  const now = canonicalTime(nowMs);
  const row = await db.prepare(`
    SELECT p.id, p.display_name, p.created_at, p.updated_at, p.xp, p.level, p.pearls,
           p.selected_skin_id, p.best_mass, p.best_score, p.games_played, p.total_eaten,
           p.status, p.session_version
    FROM sessions s
    JOIN profiles p ON p.id = s.profile_id
    WHERE s.session_id = ?
      AND s.status = 'active'
      AND s.expires_at > ?
      AND p.status = 'active'
      AND s.session_version = p.session_version
    LIMIT 1
  `).bind(id, now).first();
  return mapProfile(row);
}

export async function createModerationReport(db, reporterProfileId, input = {}, nowMs = Date.now(), reportId = crypto.randomUUID()) {
  assertDb(db);
  const reporter = canonicalProfileId(reporterProfileId);
  const target = String(input?.targetPlayerId ?? '').trim();
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(target)) throw new Error('report-target-invalid');
  const room = String(input?.room ?? '').normalize('NFKC').trim().toLowerCase().slice(0, 24);
  const reason = String(input?.reason ?? '').trim().toLowerCase();
  if (!['spam', 'abuse', 'harassment', 'cheating', 'other'].includes(reason)) throw new Error('report-reason-invalid');
  const now = canonicalTime(nowMs);
  const id = String(reportId ?? '').trim();
  if (!id || id.length > 128) throw new Error('report-id-invalid');
  const result = await db.prepare(`
    INSERT INTO moderation_reports (id, reporter_profile_id, reported_player_id, room, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, reporter, target, room, reason, now).run();
  if (result?.success === false) throw new Error('report-create-failed');
  return { ok: true, id };
}
