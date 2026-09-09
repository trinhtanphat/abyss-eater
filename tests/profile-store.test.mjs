import test from 'node:test';
import assert from 'node:assert/strict';

const store = await import('../src/profile-store.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof store[name], 'function', `${name} must be implemented`);
  return store[name];
}

function recorderDb({ firstRow = null, rows = [] } = {}) {
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
            async first() { return firstRow; },
            async all() { return { results: rows }; },
            async run() { return { success: true }; },
          };
          prepared.push(statement);
          return statement;
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    },
  };
}

test('createGuestProfile batches canonical starter profile and starter skin ownership', async () => {
  const createGuestProfile = requireFn('createGuestProfile');
  const db = recorderDb();
  const profile = await createGuestProfile(db, '  Blue   Fish!!  ', 1_800_000_000_000, 'profile-123');
  assert.deepEqual(profile, {
    id: 'profile-123',
    displayName: 'Blue Fish',
    createdAt: 1_800_000_000_000,
    updatedAt: 1_800_000_000_000,
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
  });
  assert.equal(db.batches.length, 1);
  assert.equal(db.batches[0].length, 2);
  assert.match(db.batches[0][0].sql, /INSERT INTO profiles/);
  assert.match(db.batches[0][1].sql, /INSERT INTO profile_skins/);
  assert.ok(db.batches[0][1].args.includes('reef'));
});

test('readProfile maps storage columns to bounded public profile fields', async () => {
  const readProfile = requireFn('readProfile');
  const db = recorderDb({
    firstRow: {
      id: 'profile-123', display_name: 'Blue Fish', created_at: 10, updated_at: 20,
      xp: 300, level: 3, pearls: 42, selected_skin_id: 'azure', best_mass: 8.5,
      best_score: 900, games_played: 4, total_eaten: 12, status: 'active', session_version: 2,
    },
  });
  const profile = await readProfile(db, 'profile-123');
  assert.equal(profile.id, 'profile-123');
  assert.equal(profile.displayName, 'Blue Fish');
  assert.equal(profile.xp, 300);
  assert.equal(profile.level, 3);
  assert.equal(profile.pearls, 42);
  assert.equal(profile.selectedSkinId, 'azure');
  assert.equal(profile.sessionVersion, 2);
  assert.equal(await readProfile(recorderDb({ firstRow: null }), 'missing'), null);
});

test('readOwnedSkins returns unique canonical skin ids', async () => {
  const readOwnedSkins = requireFn('readOwnedSkins');
  const db = recorderDb({ rows: [{ skin_id: 'reef' }, { skin_id: 'azure' }, { skin_id: 'reef' }, { skin_id: '' }] });
  assert.deepEqual(await readOwnedSkins(db, 'profile-123'), ['azure', 'reef']);
});
