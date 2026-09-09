import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('realtime exposes only cosmetic skin while keeping persistent identity internal', () => {
  const worker = readFileSync('src/worker.template.mjs', 'utf8');
  const publicPlayer = worker.match(/function publicPlayer\(player\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(publicPlayer.includes('skinId: player.skinId'));
  assert.equal(publicPlayer.includes('profileId'), false);
  assert.equal(publicPlayer.includes('gameSessionId'), false);
  assert.equal(publicPlayer.includes('sessionId'), false);
  for (const marker of [
    "url.searchParams.delete('profile')",
    "url.searchParams.delete('skin')",
    "url.searchParams.delete('gameSession')",
    "url.searchParams.set('skin', profile.selectedSkinId)",
    "url.searchParams.set('gameSession', gameSessionId)",
    "url.searchParams.get('skin')",
    "url.searchParams.get('gameSession')",
  ]) assert.ok(worker.includes(marker), `missing internal realtime marker: ${marker}`);
});
test('reward checkpoints are idempotent across death and disconnect boundaries', () => {
  const worker = readFileSync('src/worker.template.mjs', 'utf8');
  for (const marker of [
    'checkpointSeq: 0',
    'checkpointScore: 0',
    'checkpointMass: START_MASS',
    'checkpointEaten: 0',
    'async settleCheckpoint(player, now)',
    '`${player.gameSessionId}:${player.checkpointSeq + 1}`',
    'const scoreDelta = Math.max(0, player.score - player.checkpointScore)',
    'const massDelta = Math.max(0, player.mass - player.checkpointMass)',
    'const eatenDelta = Math.max(0, player.eaten - player.checkpointEaten)',
    'score: scoreDelta',
    'mass: 1 + massDelta',
    'eaten: eatenDelta',
    'await this.settleCheckpoint(player, now)',
  ]) assert.ok(worker.includes(marker), `missing reward checkpoint marker: ${marker}`);
  const hotLoop = worker.slice(worker.indexOf('async webSocketMessage'), worker.indexOf('async detachPlayer'));
  assert.equal(hotLoop.includes('applySessionReward('), false, 'hot input loop must not write D1 directly');
  assert.equal(hotLoop.includes('PROFILE_DB.prepare'), false, 'hot input loop must not issue D1 statements');
});

test('browser sends only signed session token on websocket connect', () => {
  const network = readFileSync('public/game/network.js', 'utf8');
  assert.ok(network.includes('function sanitizedSession'));
  assert.ok(network.includes("connect({ name, room, session = '' })"));
  assert.ok(network.includes("wsUrl.searchParams.set('session', credentials.session)"));
  assert.equal(network.includes("wsUrl.searchParams.set('profile'"), false);
  assert.equal(network.includes("wsUrl.searchParams.set('skin'"), false);
  assert.equal(network.includes("wsUrl.searchParams.set('gameSession'"), false);
});
