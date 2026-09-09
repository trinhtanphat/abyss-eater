import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

async function migratedDb() {
  const sql = await readFile('migrations/0001_profiles_progression.sql', 'utf8');
  const db = new DatabaseSync(':memory:');
  db.exec(sql);
  return db;
}

function seedProfile(db, { id = 'p1', level = 1, pearls = 0 } = {}) {
  db.prepare(`INSERT INTO profiles
    (id, display_name, created_at, updated_at, level, pearls)
    VALUES (?, ?, 1, 1, ?, ?)`)
    .run(id, 'Little Fish', level, pearls);
  db.prepare('INSERT INTO profile_skins (profile_id, skin_id, unlocked_at) VALUES (?, ?, 1)')
    .run(id, 'reef-glow');
}

test('reward_events atomically update progression once per id', async () => {
  const db = await migratedDb();
  seedProfile(db);
  const insert = db.prepare(`INSERT OR IGNORE INTO reward_events
    (id, profile_id, xp, pearls, best_mass, best_score, games_delta, total_eaten_delta, season, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  insert.run('r1', 'p1', 1000, 5, 4.5, 900, 1, 2, '2026-s1', 10);
  insert.run('r1', 'p1', 1000, 5, 9, 9999, 1, 2, '2026-s1', 11);
  const profile = db.prepare('SELECT xp, level, pearls, best_mass, best_score, games_played, total_eaten FROM profiles WHERE id = ?').get('p1');
  assert.deepEqual({ ...profile }, {
    xp: 1000, level: 2, pearls: 5, best_mass: 4.5,
    best_score: 900, games_played: 1, total_eaten: 2,
  });
  const allTime = db.prepare("SELECT best_score, games_played FROM leaderboard_entries WHERE profile_id = ? AND scope = 'all-time'").get('p1');
  const seasonal = db.prepare("SELECT best_score, games_played FROM leaderboard_entries WHERE profile_id = ? AND scope = 'seasonal' AND season = '2026-s1'").get('p1');
  assert.deepEqual({ ...allTime }, { best_score: 900, games_played: 1 });
  assert.deepEqual({ ...seasonal }, { best_score: 900, games_played: 1 });
});

test('skin purchase trigger enforces level and pearls atomically', async () => {
  const db = await migratedDb();
  seedProfile(db, { level: 1, pearls: 100 });
  const buy = db.prepare('INSERT INTO profile_skins (profile_id, skin_id, unlocked_at) VALUES (?, ?, ?)');
  assert.throws(() => buy.run('p1', 'coral-runner', 2), /level_locked/);
  db.prepare('UPDATE profiles SET level = 3, pearls = 39 WHERE id = ?').run('p1');
  assert.throws(() => buy.run('p1', 'coral-runner', 3), /insufficient_pearls/);
  db.prepare('UPDATE profiles SET pearls = 100 WHERE id = ?').run('p1');
  buy.run('p1', 'coral-runner', 4);
  assert.equal(db.prepare('SELECT pearls FROM profiles WHERE id = ?').get('p1').pearls, 60);
  assert.throws(() => buy.run('p1', 'coral-runner', 5));
  assert.equal(db.prepare('SELECT pearls FROM profiles WHERE id = ?').get('p1').pearls, 60);
});

class D1Statement {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new D1Statement(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() {
    const result = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class D1Adapter {
  constructor(db) { this.db = db; }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(statements) {
    this.db.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

test('profile store creates guest sessions and applies idempotent rewards', async () => {
  const raw = await migratedDb();
  const db = new D1Adapter(raw);
  const store = await import('../src/profile-store.mjs');
  const created = await store.createGuestProfile(db, {
    profileId: 'profile-1', sessionId: 'a'.repeat(64), displayName: 'Guest Fish',
    now: 100, expiresAt: 1000,
  });
  assert.equal(created.id, 'profile-1');
  assert.deepEqual(created.ownedSkinIds, ['reef-glow']);
  assert.equal((await store.profileForSession(db, 'a'.repeat(64), 999)).profileId, 'profile-1');
  assert.equal(await store.profileForSession(db, 'a'.repeat(64), 1001), null);

  const event = {
    id: 'event-1', profileId: 'profile-1', xp: 500, pearls: 2,
    bestMass: 3, bestScore: 700, gamesDelta: 1, totalEatenDelta: 1,
    season: '2026-s1', createdAt: 500,
  };
  await store.applyRewardEvent(db, event);
  const afterDuplicate = await store.applyRewardEvent(db, event);
  assert.equal(afterDuplicate.xp, 500);
  assert.equal(afterDuplicate.pearls, 2);
});

test('profile store returns leaderboard in descending score order', async () => {
  const raw = await migratedDb();
  seedProfile(raw, { id: 'p1' });
  seedProfile(raw, { id: 'p2' });
  raw.prepare(`INSERT INTO reward_events
    (id, profile_id, xp, pearls, best_mass, best_score, games_delta, total_eaten_delta, season, created_at)
    VALUES (?, ?, 10, 0, 2, ?, 1, 0, '2026-s1', 10)`).run('a', 'p1', 500);
  raw.prepare(`INSERT INTO reward_events
    (id, profile_id, xp, pearls, best_mass, best_score, games_delta, total_eaten_delta, season, created_at)
    VALUES (?, ?, 10, 0, 2, ?, 1, 0, '2026-s1', 10)`).run('b', 'p2', 900);
  const store = await import('../src/profile-store.mjs');
  const rows = await store.readLeaderboard(new D1Adapter(raw), 'all-time', 10);
  assert.deepEqual(rows.map((row) => row.profileId), ['p2', 'p1']);
  assert.deepEqual(rows.map((row) => row.bestScore), [900, 500]);
});
