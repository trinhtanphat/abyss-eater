import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = await import('../src/profile-store.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof store[name], 'function', `${name} must be implemented`);
  return store[name];
}

function batchDb(profileChanges = 1, leaderboardRows = []) {
  const prepared = [];
  const batches = [];
  return {
    prepared,
    batches,
    prepare(sql) {
      return {
        bind(...args) {
          const statement = {
            sql,
            args,
            async all() { return { results: leaderboardRows }; },
            async first() { return null; },
          };
          prepared.push(statement);
          return statement;
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map((_, index) => ({ success: true, meta: { changes: index === 1 ? profileChanges : 1 } }));
    },
  };
}

test('applySessionReward batches an idempotent pending event, profile update, leaderboard upsert and applied marker', async () => {
  const applySessionReward = requireFn('applySessionReward');
  const db = batchDb(1);
  const result = await applySessionReward(db, 'profile-123', 'death:room:fish:1', { score: 25, mass: 4, eaten: 2 }, 1_800_000_000_000);
  assert.equal(result.applied, true);
  assert.ok(result.reward.xp > 0);
  assert.ok(result.reward.pearls > 0);
  assert.equal(db.batches.length, 1);
  assert.equal(db.batches[0].length, 5);
  assert.match(db.batches[0][0].sql, /INSERT OR IGNORE INTO reward_events/);
  assert.match(db.batches[0][1].sql, /UPDATE profiles/);
  assert.match(db.batches[0][1].sql, /applied = 0/);
  assert.match(db.batches[0][1].sql, /best_score = MAX\(best_score, \?\)/);
  assert.match(db.batches[0][1].sql, /best_mass = MAX\(best_mass, \?\)/);
  assert.match(db.batches[0][2].sql, /INSERT INTO leaderboard_entries/);
  assert.match(db.batches[0][2].sql, /ON CONFLICT\(profile_id, season\)/);
  assert.match(db.batches[0][3].sql, /INSERT INTO leaderboard_entries/);
  assert.match(db.batches[0][3].sql, /ON CONFLICT\(profile_id, season\)/);
  assert.match(db.batches[0][4].sql, /UPDATE reward_events/);
  assert.match(db.batches[0][4].sql, /SET applied = 1/);
});

test('applySessionReward reports duplicate/no-op when guarded profile update changes zero rows', async () => {
  const applySessionReward = requireFn('applySessionReward');
  const result = await applySessionReward(batchDb(0), 'profile-123', 'death:room:fish:1', { score: 25, mass: 4 }, 1_800_000_000_000);
  assert.equal(result.applied, false);
});

test('readLeaderboard clamps limit and returns deterministic public rows', async () => {
  const readLeaderboard = requireFn('readLeaderboard');
  const db = batchDb(0, [
    { profile_id: 'p1', display_name: 'Alpha', best_score: 900, best_mass: 8, updated_at: 10 },
    { profile_id: 'p2', display_name: 'Beta', best_score: 800, best_mass: 9, updated_at: 20 },
  ]);
  const rows = await readLeaderboard(db, 'all-time', 999);
  assert.deepEqual(rows, [
    { profileId: 'p1', displayName: 'Alpha', bestScore: 900, bestMass: 8, updatedAt: 10 },
    { profileId: 'p2', displayName: 'Beta', bestScore: 800, bestMass: 9, updatedAt: 20 },
  ]);
  const statement = db.prepared.at(-1);
  assert.equal(statement.args.at(-1), 50);
  assert.match(statement.sql, /ORDER BY l.best_score DESC, l.best_mass DESC, l.updated_at ASC, l.profile_id ASC/);
});

test('Worker binds opaque persistent identity and checkpoints authoritative reward deltas', () => {
  const worker = readFileSync('src/worker.template.mjs', 'utf8');
  for (const marker of [
    "url.pathname === '/api/leaderboard'" ,
    "url.searchParams.get('session')" ,
    "url.searchParams.delete('session')" ,
    'profileForSessionToken',
    "url.searchParams.set('profile'" ,
    "url.searchParams.set('skin'" ,
    'async settleCheckpoint(player, now)',
    'applySessionReward',
    '${player.gameSessionId}:${player.checkpointSeq + 1}',
    'await this.settleCheckpoint(other, now)',
    'await this.settleCheckpoint(player, now)',
    'async detachPlayer(ws)',
  ]) assert.ok(worker.includes(marker), `Worker reward integration must include ${marker}`);
  assert.equal(worker.includes("wsUrl.searchParams.set('profile'"), false, 'browser must never choose a profile id');
});
