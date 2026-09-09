import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const client = await import('../public/client-progression.mjs').catch(() => ({}));

function requireExport(name) {
  assert.notEqual(client[name], undefined, `${name} must be implemented`);
  return client[name];
}

test('profileProgress derives bounded progress from the server level/xp contract', () => {
  const profileProgress = requireExport('profileProgress');
  assert.deepEqual(profileProgress({ level: 1, xp: 0 }), { level: 1, xp: 0, currentXp: 0, nextXp: 100, progress: 0 });
  assert.deepEqual(profileProgress({ level: 2, xp: 150 }), { level: 2, xp: 150, currentXp: 100, nextXp: 300, progress: 0.25 });
  assert.equal(profileProgress({ level: 2, xp: 1e9 }).progress, 1);
  assert.equal(profileProgress({ level: 0, xp: -20 }).level, 1);
});

test('skinAction is derived only from canonical catalog, profile and owned ids', () => {
  const skinAction = requireExport('skinAction');
  const profile = { level: 3, pearls: 75, selectedSkinId: 'reef' };
  assert.equal(skinAction({ id: 'reef', price: 0, unlockLevel: 1 }, profile, ['reef']), 'selected');
  assert.equal(skinAction({ id: 'azure', price: 50, unlockLevel: 2 }, profile, ['reef']), 'buy');
  assert.equal(skinAction({ id: 'abyssal', price: 140, unlockLevel: 4 }, profile, ['reef']), 'locked');
  assert.equal(skinAction({ id: 'sunset', price: 240, unlockLevel: 3 }, profile, ['reef']), 'insufficient');
  assert.equal(skinAction({ id: 'azure', price: 50, unlockLevel: 2 }, { ...profile, selectedSkinId: 'reef' }, ['reef', 'azure']), 'select');
});

test('progression client persists opaque session and sends only skinId to authenticated shop APIs', async () => {
  const createProgressionClient = requireExport('createProgressionClient');
  const calls = [];
  const storageData = new Map();
  const storage = {
    getItem: (key) => storageData.get(key) ?? null,
    setItem: (key, value) => storageData.set(key, value),
    removeItem: (key) => storageData.delete(key),
  };
  const responses = [
    { ok: true, token: 'payload.signature', profile: { id: 'p1', level: 2, xp: 150, pearls: 75, selectedSkinId: 'reef' }, ownedSkins: ['reef'], catalog: [{ id: 'reef' }, { id: 'azure' }] },
    { ok: true, profile: { id: 'p1', level: 2, xp: 150, pearls: 25, selectedSkinId: 'reef' }, ownedSkins: ['reef', 'azure'], catalog: [{ id: 'reef' }, { id: 'azure' }] },
  ];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const payload = responses.shift();
    return { ok: true, status: 200, json: async () => payload };
  };

  const progression = createProgressionClient({ fetchImpl, storage });
  await progression.ensureSession('Blue Fish');
  assert.equal(progression.token, 'payload.signature');
  assert.equal(storageData.get('abyss-eater-session-v1'), 'payload.signature');
  await progression.purchaseSkin('azure');
  assert.equal(calls[1].url, '/api/shop/purchase');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer payload.signature');
  assert.equal(calls[1].init.body, JSON.stringify({ skinId: 'azure' }));
  assert.equal(calls[1].init.body.includes('price'), false);
  assert.equal(calls[1].init.body.includes('pearls'), false);
});

test('client UI wires persistent profile, cosmetic actions and server leaderboard without client profile authority', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const app = readFileSync('public/app.js', 'utf8');
  const network = readFileSync('public/game/network.js', 'utf8');
  const sw = readFileSync('public/sw.js', 'utf8');

  for (const marker of ['id="profile-level"', 'id="profile-xp"', 'id="profile-pearls"', 'id="skin-grid"', 'id="persistent-leaderboard"']) {
    assert.ok(html.includes(marker), `profile UI must include ${marker}`);
  }
  for (const marker of ["from '/client-progression.mjs'", 'progression.ensureSession', 'progression.purchaseSkin', 'progression.selectSkin', 'progression.refreshLeaderboard']) {
    assert.ok(app.includes(marker), `app must include ${marker}`);
  }
  assert.ok(network.includes('session: sanitizedSession(session)'));
  assert.ok(network.includes("wsUrl.searchParams.set('session', credentials.session)"));
  assert.equal(network.includes("searchParams.set('profile'"), false, 'browser must never choose profile id');
  assert.ok(sw.includes("'/client-progression.mjs'"), 'offline shell must cache progression client');
});
