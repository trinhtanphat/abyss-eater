import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = await import('../src/profile-store.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof store[name], 'function', `${name} must be implemented`);
  return store[name];
}

function shopDb({ profile = null, owned = [], debitChanges = 1, selectChanges = 1 } = {}) {
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
            async first() {
              if (/FROM profiles/.test(sql)) return profile;
              return null;
            },
            async all() {
              if (/FROM profile_skins/.test(sql)) return { results: owned.map((skin_id) => ({ skin_id })) };
              return { results: [] };
            },
            async run() { return { success: true, meta: { changes: selectChanges } }; },
          };
          prepared.push(statement);
          return statement;
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map((_, index) => ({ success: true, meta: { changes: index === 0 ? debitChanges : debitChanges } }));
    },
  };
}

const baseProfile = {
  id: 'profile-123', display_name: 'Blue Fish', created_at: 1, updated_at: 1,
  xp: 300, level: 3, pearls: 200, selected_skin_id: 'reef', best_mass: 1,
  best_score: 0, games_played: 0, total_eaten: 0, status: 'active', session_version: 1,
};

test('purchaseSkin prices and unlocks only from canonical server catalog', async () => {
  const purchaseSkin = requireFn('purchaseSkin');
  const db = shopDb({ profile: baseProfile, owned: ['reef'], debitChanges: 1 });
  const result = await purchaseSkin(db, 'profile-123', 'azure', 1_800_000_000_000);
  assert.equal(result.ok, true);
  assert.equal(result.skinId, 'azure');
  assert.equal(result.price, 50);
  assert.equal(db.batches.length, 1);
  assert.equal(db.batches[0].length, 2);
  assert.match(db.batches[0][0].sql, /pearls = pearls - \?/);
  assert.match(db.batches[0][0].sql, /NOT EXISTS/);
  assert.match(db.batches[0][0].sql, /xp >= \?/);
  assert.ok(db.batches[0][0].args.includes(50), 'canonical catalog price must be bound server-side');
  assert.match(db.batches[0][1].sql, /INSERT OR IGNORE INTO profile_skins/);
  assert.match(db.batches[0][1].sql, /changes\(\) = 1/);
});

test('purchaseSkin rejects unknown/default/owned/locked/insufficient purchases without mutation', async () => {
  const purchaseSkin = requireFn('purchaseSkin');
  assert.deepEqual(await purchaseSkin(shopDb({ profile: baseProfile }), 'profile-123', 'missing', 10), { ok: false, code: 'unknown_skin' });
  assert.deepEqual(await purchaseSkin(shopDb({ profile: baseProfile }), 'profile-123', 'reef', 10), { ok: false, code: 'already_owned' });
  assert.deepEqual(await purchaseSkin(shopDb({ profile: baseProfile, owned: ['reef', 'azure'] }), 'profile-123', 'azure', 10), { ok: false, code: 'already_owned' });
  const locked = { ...baseProfile, xp: 0, pearls: 999 };
  assert.deepEqual(await purchaseSkin(shopDb({ profile: locked, owned: ['reef'] }), 'profile-123', 'azure', 10), { ok: false, code: 'locked' });
  const poor = { ...baseProfile, pearls: 1 };
  assert.deepEqual(await purchaseSkin(shopDb({ profile: poor, owned: ['reef'] }), 'profile-123', 'azure', 10), { ok: false, code: 'insufficient_pearls' });
});

test('selectSkin only selects an owned canonical cosmetic and is idempotent', async () => {
  const selectSkin = requireFn('selectSkin');
  assert.deepEqual(await selectSkin(shopDb({ profile: baseProfile, owned: ['reef', 'azure'], selectChanges: 1 }), 'profile-123', 'azure', 10), { ok: true, skinId: 'azure' });
  assert.deepEqual(await selectSkin(shopDb({ profile: { ...baseProfile, selected_skin_id: 'azure' }, owned: ['reef', 'azure'] }), 'profile-123', 'azure', 10), { ok: true, skinId: 'azure' });
  assert.deepEqual(await selectSkin(shopDb({ profile: baseProfile, owned: ['reef'] }), 'profile-123', 'azure', 10), { ok: false, code: 'not_owned' });
  assert.deepEqual(await selectSkin(shopDb({ profile: baseProfile, owned: ['reef'] }), 'profile-123', 'missing', 10), { ok: false, code: 'unknown_skin' });
});

test('shop APIs accept only skinId and never client price or balance authority', () => {
  const worker = readFileSync('src/worker.template.mjs', 'utf8');
  for (const marker of [
    "url.pathname === '/api/shop/purchase'",
    "url.pathname === '/api/profile/skin'",
    'purchaseSkin',
    'selectSkin',
    'body.skinId',
  ]) assert.ok(worker.includes(marker), `Worker shop API must include ${marker}`);
  assert.equal(worker.includes('body.price'), false);
  assert.equal(worker.includes('body.pearls'), false);
  assert.equal(worker.includes('body.balance'), false);
});
