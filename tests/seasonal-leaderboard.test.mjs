import test from 'node:test';
import assert from 'node:assert/strict';

const progression = await import('../src/progression.mjs').catch(() => ({}));
const store = await import('../src/profile-store.mjs').catch(() => ({}));

function recorderDb(rows = []) {
  const prepared = [];
  const batches = [];
  return {
    prepared, batches,
    prepare(sql) {
      return { bind(...args) {
        const statement = { sql, args, async all() { return { results: rows }; } };
        prepared.push(statement);
        return statement;
      } };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map((_, index) => ({ success: true, meta: { changes: index === 1 ? 1 : 1 } }));
    },
  };
}

test('season key is deterministic by UTC quarter', () => {
  assert.equal(typeof progression.seasonForTimestamp, 'function');
  assert.equal(progression.seasonForTimestamp(Date.UTC(2026, 8, 9)), '2026-q3');
  assert.equal(progression.seasonForTimestamp(Date.UTC(2027, 0, 1)), '2027-q1');
});
test('reward checkpoint updates all-time and current season before marking event applied', async () => {
  assert.equal(typeof store.applySessionReward, 'function');
  const db = recorderDb();
  const now = Date.UTC(2026, 8, 9);
  const result = await store.applySessionReward(db, 'profile-123', 'game:1', { score: 25, mass: 4, eaten: 2 }, now);
  assert.equal(result.applied, true);
  assert.equal(db.batches.length, 1);
  assert.equal(db.batches[0].length, 5);
  assert.ok(db.batches[0][2].args.includes('all-time'));
  assert.ok(db.batches[0][3].args.includes('2026-q3'));
  assert.match(db.batches[0][4].sql, /SET applied = 1/);
});

test('seasonal leaderboard resolves current season while all-time remains stable', async () => {
  assert.equal(typeof store.readLeaderboard, 'function');
  const now = Date.UTC(2026, 8, 9);
  const seasonalDb = recorderDb([]);
  await store.readLeaderboard(seasonalDb, 'seasonal', 10, now);
  assert.equal(seasonalDb.prepared.at(-1).args[0], '2026-q3');
  const allTimeDb = recorderDb([]);
  await store.readLeaderboard(allTimeDb, 'all-time', 10, now);
  assert.equal(allTimeDb.prepared.at(-1).args[0], 'all-time');
});
