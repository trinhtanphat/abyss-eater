import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const store = await import('../src/profile-store.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof store[name], 'function', `${name} must be implemented`);
  return store[name];
}

test('opaque session migration persists server-side session to profile mapping', async () => {
  const sql = await readFile('migrations/0002_opaque_sessions.sql', 'utf8');
  for (const marker of [
    'CREATE TABLE sessions',
    'session_id',
    'profile_id',
    'expires_at',
    'session_version',
    'FOREIGN KEY(profile_id) REFERENCES profiles(id)',
    'idx_sessions_profile',
    'idx_sessions_expiry',
  ]) assert.ok(sql.includes(marker), `missing session migration marker: ${marker}`);
});
function recorderDb(firstRow = null) {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      return {
        bind(...args) {
          const statement = {
            sql,
            args,
            async run() { return { success: true, meta: { changes: 1 } }; },
            async first() { return firstRow; },
          };
          statements.push(statement);
          return statement;
        },
      };
    },
  };
}

test('profile store persists opaque sessions without putting profile id in the credential', async () => {
  const createSession = requireFn('createSession');
  const db = recorderDb();
  await createSession(db, {
    sessionId: 'a'.repeat(64), profileId: 'profile-123', createdAt: 100,
    expiresAt: 1000, sessionVersion: 2,
  });
  assert.match(db.statements[0].sql, /INSERT INTO sessions/);
  assert.deepEqual(db.statements[0].args, ['a'.repeat(64), 'profile-123', 100, 1000, 2]);
});
test('profileForSession resolves only an unexpired active profile session', async () => {
  const profileForSession = requireFn('profileForSession');
  const row = {
    id: 'profile-123', display_name: 'Blue Fish', created_at: 10, updated_at: 20,
    xp: 300, level: 3, pearls: 42, selected_skin_id: 'azure', best_mass: 8.5,
    best_score: 900, games_played: 4, total_eaten: 12, status: 'active', session_version: 2,
  };
  const db = recorderDb(row);
  const profile = await profileForSession(db, 'b'.repeat(64), 500);
  assert.equal(profile.id, 'profile-123');
  assert.equal(profile.selectedSkinId, 'azure');
  assert.match(db.statements[0].sql, /FROM sessions s/);
  assert.match(db.statements[0].sql, /s\.expires_at > \?/);
  assert.match(db.statements[0].sql, /s\.session_version = p\.session_version/);
  assert.deepEqual(db.statements[0].args, ['b'.repeat(64), 500]);
});
