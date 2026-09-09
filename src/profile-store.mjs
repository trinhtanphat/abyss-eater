import { levelForXp, rewardForSession, skinById } from './progression.mjs';

function canonicalProfileId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.length > 128) throw new Error('profile-id-invalid');
  return id;
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
  return {
    id: String(row.id ?? ''),
    displayName: String(row.display_name ?? 'Little Fish'),
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
    xp: Math.max(0, Number(row.xp ?? 0)),
    level: Math.max(1, Number(row.level ?? 1)),
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
