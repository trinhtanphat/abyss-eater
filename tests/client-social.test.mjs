import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeMutedIds, toggleMutedId } from '../public/client-social.mjs';

test('local mute ids are unique bounded and client-only', () => {
  const many = ['a', 'a', ...Array.from({ length: 40 }, (_, i) => `p${i}`), '<bad>'];
  const normalized = normalizeMutedIds(many);
  assert.equal(normalized.length, 32);
  assert.equal(normalized[0], 'a');
  assert.equal(normalized.includes('<bad>'), false);
  assert.equal(new Set(normalized).size, normalized.length);
  assert.deepEqual(toggleMutedId(['a'], 'a'), []);
  assert.deepEqual(toggleMutedId([], 'b'), ['b']);
});

test('network supports additive protocol-v2 chat send and receive', async () => {
  const network = await readFile('public/game/network.js', 'utf8');
  assert.match(network, /VERSIONED_MESSAGE_TYPES.*chat/);
  assert.match(network, /onChat/);
  assert.match(network, /function sendChat/);
  assert.match(network, /type: 'chat'/);
});
test('lobby exposes Quick Dive, private room, party and bounded chat controls', async () => {
  const html = await readFile('public/index.html', 'utf8');
  for (const id of ['quick-dive-button', 'play-button', 'party-panel', 'party-code', 'party-members', 'chat-panel', 'chat-log', 'chat-input', 'chat-send']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing social control ${id}`);
  }
  assert.match(html, /maxlength="160"/);
});

test('client social API uses opaque bearer token and never submits profile identity', async () => {
  const social = await readFile('public/client-social.mjs', 'utf8');
  assert.match(social, /Authorization/);
  assert.match(social, /\/api\/matchmaking\/quick/);
  assert.match(social, /\/api\/party\/create/);
  assert.match(social, /\/api\/report/);
  assert.equal(social.includes('profileId:'), false);
});

test('app renders chat as text, supports local mute/report and resolves Quick Dive before connect', async () => {
  const app = await readFile('public/app.js', 'utf8');
  assert.match(app, /createSocialClient/);
  assert.match(app, /social\.quickDive/);
  assert.match(app, /onChat/);
  assert.match(app, /textContent/);
  assert.match(app, /toggleMutedId/);
  assert.match(app, /social\.report/);
});