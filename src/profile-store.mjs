export const CURRENT_SEASON = '2026-s1';

function storeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function profileShape(row, ownedSkinIds = []) {
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    xp: row.xp,
    level: row.level,
    pearls: row.pearls,
    selectedSkinId: row.selected_skin_id,
    bestMass: row.best_mass,
    bestScore: row.best_score,
    gamesPlayed: row.games_played,
    totalEaten: row.total_eaten,
    status: row.status,
    sessionVersion: row.session_version,
    ownedSkinIds,
  };
}

function safeDisplayName(value) {
  const name = String(value ?? '').normalize('NFKC').trim().slice(0, 20);
  return name || 'Little Fish';
}

export async function readProfile(db, profileId) {
  const row = await db.prepare(`SELECT id, display_name, created_at, updated_at, xp, level, pearls,
      selected_skin_id, best_mass, best_score, games_played, total_eaten, status, session_version
    FROM profiles WHERE id = ?`).bind(profileId).first();
  if (!row) return null;
  const owned = await db.prepare(`SELECT skin_id FROM profile_skins
    WHERE profile_id = ? ORDER BY unlocked_at ASC, skin_id ASC`).bind(profileId).all();
  return profileShape(row, (owned.results || []).map((entry) => entry.skin_id));
}

export async function createGuestProfile(db, input) {
  const { profileId, sessionId, now, expiresAt } = input;
  if (!profileId || !/^[a-f0-9]{64}$/i.test(String(sessionId ?? ''))) throw storeError('invalid_identity');
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(expiresAt) || expiresAt <= now) {
    throw storeError('invalid_session_expiry');
  }
  await db.batch([
    db.prepare(`INSERT INTO profiles (id, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?)`)
      .bind(profileId, safeDisplayName(input.displayName), now, now),
    db.prepare(`INSERT INTO profile_skins (profile_id, skin_id, unlocked_at)
      VALUES (?, 'reef-glow', ?)`)
      .bind(profileId, now),
    db.prepare(`INSERT INTO sessions (id, profile_id, created_at, expires_at, version)
      VALUES (?, ?, ?, ?, 1)`)
      .bind(sessionId, profileId, now, expiresAt),
  ]);
  return readProfile(db, profileId);
}

export async function profileForSession(db, sessionId, now) {
  if (!/^[a-f0-9]{64}$/i.test(String(sessionId ?? '')) || !Number.isFinite(now)) return null;
  const row = await db.prepare(`SELECT s.profile_id, p.selected_skin_id
    FROM sessions s
    JOIN profiles p ON p.id = s.profile_id
    WHERE s.id = ? AND s.expires_at >= ? AND s.version = p.session_version
      AND p.status = 'active'`)
    .bind(sessionId, Math.floor(now)).first();
  return row ? { profileId: row.profile_id, selectedSkinId: row.selected_skin_id } : null;
}

export async function applyRewardEvent(db, event) {
  await db.prepare(`INSERT INTO reward_events
    (id, profile_id, xp, pearls, best_mass, best_score, games_delta,
     total_eaten_delta, season, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
    RETURNING id`)
    .bind(
      event.id, event.profileId, event.xp, event.pearls, event.bestMass,
      event.bestScore, event.gamesDelta, event.totalEatenDelta,
      event.season || CURRENT_SEASON, event.createdAt,
    ).first();
  return readProfile(db, event.profileId);
}

export async function buySkin(db, profileId, skinId, now) {
  try {
    await db.prepare(`INSERT INTO profile_skins (profile_id, skin_id, unlocked_at)
      VALUES (?, ?, ?) RETURNING skin_id`).bind(profileId, skinId, now).first();
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes('level_locked')) throw storeError('level_locked');
    if (message.includes('insufficient_pearls')) throw storeError('insufficient_pearls');
    if (message.includes('unknown_skin') || message.includes('FOREIGN KEY')) throw storeError('unknown_skin');
    if (!message.includes('UNIQUE') && !message.includes('PRIMARY KEY')) throw error;
  }
  return readProfile(db, profileId);
}

export async function selectSkin(db, profileId, skinId, now) {
  const row = await db.prepare(`UPDATE profiles
    SET selected_skin_id = ?, updated_at = ?
    WHERE id = ? AND EXISTS (
      SELECT 1 FROM profile_skins WHERE profile_id = ? AND skin_id = ?
    )
    RETURNING selected_skin_id`)
    .bind(skinId, now, profileId, profileId, skinId).first();
  if (!row) throw storeError('skin_not_owned');
  return readProfile(db, profileId);
}

export async function readLeaderboard(db, scope = 'all-time', limit = 20) {
  const normalizedScope = scope === 'seasonal' ? 'seasonal' : 'all-time';
  const season = normalizedScope === 'seasonal' ? CURRENT_SEASON : '';
  const boundedLimit = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 20));
  const result = await db.prepare(`SELECT l.profile_id, p.display_name, l.best_score, l.best_mass,
      l.games_played, l.total_eaten, l.updated_at
    FROM leaderboard_entries l
    JOIN profiles p ON p.id = l.profile_id
    WHERE l.scope = ? AND l.season = ? AND p.status = 'active'
    ORDER BY l.best_score DESC, l.best_mass DESC, l.updated_at ASC, l.profile_id ASC
    LIMIT ?`).bind(normalizedScope, season, boundedLimit).all();
  return (result.results || []).map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name,
    bestScore: row.best_score,
    bestMass: row.best_mass,
    gamesPlayed: row.games_played,
    totalEaten: row.total_eaten,
  }));
}
