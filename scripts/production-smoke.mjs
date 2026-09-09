import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const PROTOCOL_VERSION = 2;
export const PLAYER_COUNT = 4;
export const PRODUCTION_BASES = Object.freeze([
  'https://abyss-eater.hikvision.workers.dev',
  'https://abyss-eater.qs3d.site',
]);
export const CRITICAL_ASSETS = Object.freeze([
  '/',
  '/sw.js',
  '/themes.css',
  '/hud-assets.css',
  '/client-progression.mjs',
  '/client-tts.mjs',
  '/app.js',
  '/game/state.js',
  '/game/biomes.js',
  '/game/world-actors.js',
  '/game/fish.js',
  '/game/fish-skins.mjs',
  '/game/environment.js',
  '/game/themes.js',
  '/game/presentation.js',
]);

export function normalizeStaticText(value) {
  return String(value).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function healthLooksReady(payload = {}) {
  return payload?.ok === true
    && payload?.version === '0.3.0'
    && payload?.protocolVersion === PROTOCOL_VERSION
    && payload?.roomPoolSize === 64
    && payload?.snapshotHzCap === 20
    && payload?.wildlifePerRoom === 24
    && payload?.biomes === 4
    && payload?.hazardsPerRoom === 8
    && payload?.pickupsPerRoom === 12;
}

export function validateWelcome(message) {
  assert.equal(message?.type, 'welcome', 'welcome message type is required');
  assert.equal(message?.v, PROTOCOL_VERSION, 'protocol v2 welcome is required');
  assert.ok(typeof message?.id === 'string' && message.id, 'player id is required');
  assert.ok(typeof message?.room === 'string' && message.room, 'canonical room is required');
  assert.ok(typeof message?.resumeKey === 'string' && message.resumeKey, 'resume key is required');
  assert.ok(Number.isSafeInteger(message?.inputSeq) && message.inputSeq >= 0, 'input sequence is required');
  assert.ok(message?.snapshot && Array.isArray(message.snapshot.players), 'welcome snapshot is required');
  assert.ok(Array.isArray(message.snapshot.hazards) && Array.isArray(message.snapshot.pickups), 'world snapshot is required');
  return message;
}

export function buildWsUrl(base, { name, room, resumeKey = '' } = {}) {
  const url = new URL('/ws', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('name', String(name || 'Smoke Fish').slice(0, 20));
  url.searchParams.set('room', String(room || 'smoke-room').slice(0, 24));
  if (resumeKey) url.searchParams.set('resume', String(resumeKey).slice(0, 160));
  return url;
}

function localAssetPath(asset) {
  return asset === '/' ? 'public/index.html' : `public${asset}`;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  assert.equal(response.ok, true, `${url} returned HTTP ${response.status}`);
  return response.text();
}

async function verifyHealth(base) {
  const response = await fetch(`${base}/health`, { headers: { 'cache-control': 'no-cache' } });
  assert.equal(response.ok, true, `${base}/health returned HTTP ${response.status}`);
  const payload = await response.json();
  assert.equal(healthLooksReady(payload), true, `${base}/health contract mismatch: ${JSON.stringify(payload)}`);
  return payload;
}

async function verifyStaticParity(base) {
  for (const asset of CRITICAL_ASSETS) {
    const [local, live] = await Promise.all([
      readFile(localAssetPath(asset), 'utf8'),
      fetchText(`${base}${asset}`),
    ]);
    assert.equal(normalizeStaticText(live), normalizeStaticText(local), `${base}${asset} does not match current main checkout`);
  }
}

function waitFor(predicate, timeoutMs, label) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      try {
        if (predicate()) return resolve();
      } catch (error) {
        return reject(error);
      }
      if (Date.now() - started >= timeoutMs) return reject(new Error(`Timed out waiting for ${label}`));
      setTimeout(poll, 50);
    };
    poll();
  });
}

async function openPlayer(base, identity) {
  const socket = new WebSocket(buildWsUrl(base, identity));
  const state = { welcome: null, snapshot: null, pong: null, errors: [] };
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }
    if (message?.type === 'welcome') state.welcome = validateWelcome(message);
    else if (message?.type === 'snapshot') state.snapshot = message;
    else if (message?.type === 'pong') state.pong = message;
    else if (message?.type === 'error') state.errors.push(message);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`WebSocket open timeout: ${identity.name}`)), 8000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`WebSocket error: ${identity.name}`)); }, { once: true });
  });
  await waitFor(() => state.welcome, 8000, `${identity.name} welcome`);
  return { socket, state };
}

async function closePlayer(player) {
  if (!player?.socket || player.socket.readyState >= WebSocket.CLOSING) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 1200);
    player.socket.addEventListener('close', () => { clearTimeout(timer); resolve(); }, { once: true });
    player.socket.close(1000, 'production smoke');
  });
}

async function verifyRealtime(base) {
  const room = `smoke-${Date.now().toString(36)}`.slice(0, 24);
  const players = [];
  try {
    for (let index = 0; index < PLAYER_COUNT; index += 1) {
      players.push(await openPlayer(base, { name: `Smoke Fish ${index + 1}`, room }));
    }
    await waitFor(
      () => players.every(({ state }) => (state.snapshot || state.welcome?.snapshot)?.players?.length >= PLAYER_COUNT),
      8000,
      'all four players in shared snapshots',
    );

    for (const { socket, state } of players) {
      state.pong = null;
      const sentAt = Date.now();
      socket.send(JSON.stringify({ type: 'ping', v: PROTOCOL_VERSION, t: sentAt }));
      await waitFor(() => state.pong?.v === PROTOCOL_VERSION, 5000, 'protocol-v2 pong');
      assert.equal(state.errors.length, 0, `server returned an error: ${JSON.stringify(state.errors)}`);
    }

    const mover = players[1];
    mover.socket.send(JSON.stringify({
      type: 'input',
      v: PROTOCOL_VERSION,
      seq: mover.state.welcome.inputSeq + 1,
      dir: { x: 0.35, y: 0, z: 0.2 },
    }));
    await delay(180);
    assert.equal(mover.state.errors.length, 0, 'valid movement input must not be rejected');

    const originalId = players[0].state.welcome.id;
    const originalResumeKey = players[0].state.welcome.resumeKey;
    await closePlayer(players[0]);
    await delay(180);
    const resumed = await openPlayer(base, {
      name: 'Smoke Fish 1',
      room,
      resumeKey: originalResumeKey,
    });
    assert.equal(resumed.state.welcome.resumed, true, 'reconnect must resume the prior fish');
    assert.equal(resumed.state.welcome.id, originalId, 'reconnect must preserve the player id');
    players[0] = resumed;

    return {
      room: resumed.state.welcome.room,
      players: PLAYER_COUNT,
      resumedId: originalId,
    };
  } finally {
    await Promise.allSettled(players.map(closePlayer));
  }
}

async function verifyConvergedProduction() {
  for (const base of PRODUCTION_BASES) {
    await verifyHealth(base);
    await verifyStaticParity(base);
    console.log(`static+health OK ${base}`);
  }
  const realtime = await verifyRealtime(PRODUCTION_BASES[1]);
  console.log(`realtime OK room=${realtime.room} players=${realtime.players} resume=${realtime.resumedId}`);
}

export async function runProductionSmoke({
  attempts = Number(process.env.ABYSS_SMOKE_ATTEMPTS || 18),
  retryDelayMs = Number(process.env.ABYSS_SMOKE_RETRY_MS || 5000),
} = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      console.log(`production smoke attempt ${attempt}/${attempts}`);
      await verifyConvergedProduction();
      console.log('production smoke PASS');
      return true;
    } catch (error) {
      lastError = error;
      console.error(`production smoke attempt ${attempt} failed: ${error.message}`);
      if (attempt < attempts) await delay(retryDelayMs);
    }
  }
  throw lastError || new Error('production smoke failed');
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  runProductionSmoke().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
