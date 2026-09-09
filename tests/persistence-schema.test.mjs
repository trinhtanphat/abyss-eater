import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const migrationPath = 'migrations/0001_profiles.sql';

test('Carrier 3 migration defines durable profile, ownership, rewards and leaderboard state', () => {
  assert.equal(existsSync(migrationPath), true, `${migrationPath} must exist`);
  const sql = readFileSync(migrationPath, 'utf8');
  for (const marker of [
    'CREATE TABLE profiles',
    'session_version',
    'selected_skin_id',
    'CREATE TABLE profile_skins',
    'PRIMARY KEY(profile_id, skin_id)',
    'CREATE TABLE reward_events',
    'CREATE TABLE leaderboard_entries',
    'PRIMARY KEY(profile_id, season)',
    'CREATE INDEX idx_leaderboard_rank',
  ]) {
    assert.ok(sql.includes(marker), `migration must include ${marker}`);
  }
  assert.equal(/DROP\s+TABLE/i.test(sql), false, 'initial migration must not destroy durable state');
});

test('authoritative Worker config binds one real D1 database without weakening existing Durable Object config', () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(config.account_id, '6c5207813df3d5b83b9508125e0e9e12');
  assert.ok(config.durable_objects?.bindings?.some((binding) => binding.name === 'GAME_ROOM' && binding.class_name === 'GameRoom'));
  assert.ok(config.migrations?.some((migration) => migration.tag === 'v1'));
  assert.equal(config.d1_databases?.length, 1);
  const database = config.d1_databases?.[0];
  assert.equal(database?.binding, 'DB');
  assert.equal(database?.database_name, 'abyss-eater-progression');
  assert.match(database?.database_id ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.equal(String(database?.database_id ?? '').includes('<'), false, 'database id must not be a placeholder');
});
