import { DurableObject } from 'cloudflare:workers';

/*__GAME_LOGIC__*/
/*__WILDLIFE__*/
/*__PROTOCOL__*/
/*__SPATIAL_GRID__*/
/*__ROOM_STATE__*/
/*__PROGRESSION__*/
/*__SESSION_TOKEN__*/
/*__PROFILE_STORE__*/

const ASSETS = /*__ASSETS__*/;
const WORLD_BOUNDS = { x: 80, y: 28, z: 80 };
const MAX_PLAYERS = 20;
const FOOD_COUNT = 42;
const FOOD_VALUE = 0.2;
const VERSION = '0.3.0';
const INPUT_RATE_LIMIT = 25;
const INPUT_RATE_WINDOW_MS = 1000;
const COLLISION_CELL_SIZE = 8;
const RECONNECT_INDEX_KEY = 'reconnect:index';
const MAX_RECONNECT_SLOTS = MAX_PLAYERS * 2;
const SNAPSHOT_MIN_INTERVAL_MS = 50;
const ROOM_POOL_SIZE = 64;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_API_BODY_BYTES = 2048;

function boundedText(value, fallback, maxLength) {
  const normalized = String(value ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || fallback).slice(0, maxLength);
}

function boundedResumeKey(value) {
  const key = String(value ?? '').trim();
  return /^[a-f0-9]{64}$/i.test(key) ? key : '';
}

function boundedProfileId(value) {
  const id = String(value ?? '').trim();
  return /^[A-Za-z0-9._:-]{1,128}$/.test(id) ? id : '';
}

function boundedSkinId(value) {
  return skinById(String(value ?? '').trim())?.id || 'reef';
}

function boundedGameSessionId(value) {
  const id = String(value ?? '').trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(id) ? id : '';
}

function reconnectStorageKey(resumeKey) {
  return `reconnect:${resumeKey}`;
}

function spawnPoint() {
  return {
    x: (Math.random() * 2 - 1) * WORLD_BOUNDS.x * 0.72,
    y: (Math.random() * 2 - 1) * WORLD_BOUNDS.y * 0.72,
    z: (Math.random() * 2 - 1) * WORLD_BOUNDS.z * 0.72,
  };
}

function spawnFood() {
  return {
    id: crypto.randomUUID().slice(0, 12),
    position: spawnPoint(),
    value: FOOD_VALUE,
  };
}

function makeFood(count = FOOD_COUNT) {
  return Array.from({ length: count }, spawnFood);
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    mass: player.mass,
    score: player.score,
    deaths: player.deaths,
    skinId: player.skinId,
  };
}

function publicWildlife(actor) {
  return {
    id: actor.id,
    kind: 'wildlife',
    name: actor.name,
    position: actor.position,
    mass: actor.mass,
  };
}

function securityHeaders(contentType) {
  return {
    'content-type': contentType,
    'cache-control': contentType.startsWith('text/html') ? 'no-cache' : 'public, max-age=300',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; font-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  };
}

function jsonApi(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...securityHeaders('application/json; charset=utf-8'),
      'cache-control': 'no-store',
    },
  });
}

function persistenceUnavailable() {
  return jsonApi({ ok: false, code: 'persistence_unavailable', error: 'persistence_unavailable' }, 503);
}

function bearerFromRequest(request) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim().slice(0, 4096);
}

async function readSmallJson(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_API_BODY_BYTES) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_API_BODY_BYTES) return null;
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function databaseReady(env) {
  return Boolean(env?.PROFILE_DB && typeof env.PROFILE_DB.prepare === 'function');
}

function persistenceReady(env) {
  return Boolean(databaseReady(env) && typeof env.SESSION_SIGNING_KEY === 'string' && env.SESSION_SIGNING_KEY.length >= 16);
}

async function authenticatedProfile(request, env, now = Date.now()) {
  if (!persistenceReady(env)) return { response: persistenceUnavailable() };
  const token = bearerFromRequest(request);
  if (!token) return { response: jsonApi({ ok: false, code: 'unauthorized' }, 401) };
  const session = await verifySession(token, env.SESSION_SIGNING_KEY, now);
  if (!session) return { response: jsonApi({ ok: false, code: 'unauthorized' }, 401) };
  try {
    const profile = await profileForSession(env.PROFILE_DB, session.sessionId, now);
    if (!profile) return { response: jsonApi({ ok: false, code: 'unauthorized' }, 401) };
    return { session, profile };
  } catch {
    return { response: persistenceUnavailable() };
  }
}

async function profileForSessionToken(token, env, now = Date.now()) {
  if (!token || !persistenceReady(env)) return null;
  try {
    const session = await verifySession(token, env.SESSION_SIGNING_KEY, now);
    if (!session) return null;
    return await profileForSession(env.PROFILE_DB, session.sessionId, now);
  } catch {
    return null;
  }
}

async function handleSessionApi(request, env) {
  if (request.method !== 'POST') return jsonApi({ ok: false, code: 'method_not_allowed' }, 405);
  if (!persistenceReady(env)) return persistenceUnavailable();
  const body = await readSmallJson(request);
  if (!body) return jsonApi({ ok: false, code: 'invalid_request' }, 400);
  const now = Date.now();

  try {
    const profile = await createGuestProfile(env.PROFILE_DB, body.displayName, now, crypto.randomUUID());
    const sessionId = newSessionId();
    const expiresAt = now + SESSION_TTL_MS;
    await createSession(env.PROFILE_DB, {
      sessionId,
      profileId: profile.id,
      createdAt: now,
      expiresAt,
      sessionVersion: profile.sessionVersion,
    });
    const ownedSkins = await readOwnedSkins(env.PROFILE_DB, profile.id);
    const token = await signSession({ sessionId, version: profile.sessionVersion, expiresAt }, env.SESSION_SIGNING_KEY, now);
    return jsonApi({ ok: true, token, profile, ownedSkins, catalog: SKIN_CATALOG }, 200);
  } catch {
    return persistenceUnavailable();
  }
}

async function handleProfileApi(request, env) {
  if (request.method !== 'GET') return jsonApi({ ok: false, code: 'method_not_allowed' }, 405);
  const auth = await authenticatedProfile(request, env);
  if (auth.response) return auth.response;
  try {
    const ownedSkins = await readOwnedSkins(env.PROFILE_DB, auth.profile.id);
    return jsonApi({ ok: true, profile: auth.profile, ownedSkins, catalog: SKIN_CATALOG });
  } catch {
    return persistenceUnavailable();
  }
}

async function handleLeaderboardApi(request, env, url) {
  if (request.method !== 'GET') return jsonApi({ ok: false, code: 'method_not_allowed' }, 405);
  if (!databaseReady(env)) return persistenceUnavailable();
  try {
    const scope = url.searchParams.get('scope') || url.searchParams.get('season') || 'all-time';
    const limit = Number(url.searchParams.get('limit') || 10);
    const leaderboard = await readLeaderboard(env.PROFILE_DB, scope, limit);
    return jsonApi({ ok: true, scope: scope === 'seasonal' ? 'seasonal' : 'all-time', leaderboard });
  } catch {
    return persistenceUnavailable();
  }
}

async function handleSkinsApi(request, env) {
  if (request.method !== 'GET') return jsonApi({ ok: false, code: 'method_not_allowed' }, 405);
  if (!databaseReady(env)) return persistenceUnavailable();
  return jsonApi({ ok: true, catalog: SKIN_CATALOG });
}

function shopStatus(result) {
  if (result?.ok) return 200;
  if (result?.code === 'profile_not_found') return 404;
  if (result?.code === 'purchase_conflict') return 409;
  if (result?.code === 'insufficient_pearls' || result?.code === 'locked' || result?.code === 'already_owned' || result?.code === 'not_owned') return 409;
  return 400;
}

async function handleShopPurchaseApi(request, env) {
  if (request.method !== 'POST') return jsonApi({ ok: false, code: 'method_not_allowed' }, 405);
  const auth = await authenticatedProfile(request, env);
  if (auth.response) return auth.response;
  const body = await readSmallJson(request);
  if (!body || typeof body.skinId !== 'string') return jsonApi({ ok: false, code: 'invalid_request' }, 400);
  try {
    const result = await purchaseSkin(env.PROFILE_DB, auth.profile.id, body.skinId, Date.now());
    if (!result.ok) return jsonApi(result, shopStatus(result));
    const profile = await readProfile(env.PROFILE_DB, auth.profile.id);
    const ownedSkins = await readOwnedSkins(env.PROFILE_DB, auth.profile.id);
    return jsonApi({ ...result, profile, ownedSkins, catalog: SKIN_CATALOG });
  } catch {
    return persistenceUnavailable();
  }
}

async function handleSelectSkinApi(request, env) {
  if (request.method !== 'POST') return jsonApi({ ok: false, code: 'method_not_allowed' }, 405);
  const auth = await authenticatedProfile(request, env);
  if (auth.response) return auth.response;
  const body = await readSmallJson(request);
  if (!body || typeof body.skinId !== 'string') return jsonApi({ ok: false, code: 'invalid_request' }, 400);
  try {
    const result = await selectSkin(env.PROFILE_DB, auth.profile.id, body.skinId, Date.now());
    if (!result.ok) return jsonApi(result, shopStatus(result));
    const profile = await readProfile(env.PROFILE_DB, auth.profile.id);
    return jsonApi({ ...result, profile, catalog: SKIN_CATALOG });
  } catch {
    return persistenceUnavailable();
  }
}

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.food = [];
    this.wildlife = makeWildlifePopulation(spawnPoint, () => crypto.randomUUID().slice(0, 12));
    this.snapshotSeq = 0;
    this.lastBroadcastAt = 0;
    this.lastWildlifeStepAt = 0;
    this.foodDirty = true;
    this.wildlifeDirty = true;
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get('food');
      this.food = Array.isArray(stored) && stored.length ? stored : makeFood();
      if (!stored) await this.ctx.storage.put('food', this.food);
    });
  }

  socketsWithPlayers() {
    return this.ctx.getWebSockets()
      .map((socket) => ({ socket, player: socket.deserializeAttachment() }))
      .filter(({ player }) => player?.id && player.interactive !== false);
  }

  snapshot(includeFood = false, includeWildlife = false) {
    const value = {
      type: 'snapshot',
      v: PROTOCOL_VERSION,
      seq: ++this.snapshotSeq,
      serverTime: Date.now(),
      players: this.socketsWithPlayers().map(({ player }) => publicPlayer(player)),
    };
    if (includeFood) value.food = this.food;
    if (includeWildlife) value.wildlife = this.wildlife.map(publicWildlife);
    return value;
  }

  broadcastSnapshot(force = false) {
    const now = Date.now();
    if (!force && !shouldBroadcast(this.lastBroadcastAt, now, SNAPSHOT_MIN_INTERVAL_MS)) return false;
    const includeFood = this.foodDirty;
    const includeWildlife = this.wildlifeDirty;
    const payload = JSON.stringify(this.snapshot(includeFood, includeWildlife));
    for (const { socket } of this.socketsWithPlayers()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
    this.lastBroadcastAt = now;
    if (includeFood) this.foodDirty = false;
    if (includeWildlife) this.wildlifeDirty = false;
    return true;
  }

  sendError(ws, code) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', v: PROTOCOL_VERSION, code }));
    }
  }

  async settleCheckpoint(player, now) {
    if (!player?.profileId || !databaseReady(this.env)) return player;
    const scoreDelta = Math.max(0, player.score - player.checkpointScore);
    const massDelta = Math.max(0, player.mass - player.checkpointMass);
    const eatenDelta = Math.max(0, player.eaten - player.checkpointEaten);
    if (scoreDelta <= 0 && massDelta <= 0 && eatenDelta <= 0) return player;
    const rewardEventId = `${player.gameSessionId}:${player.checkpointSeq + 1}`;
    try {
      await applySessionReward(this.env.PROFILE_DB, player.profileId, rewardEventId, {
        score: scoreDelta,
        mass: 1 + massDelta,
        eaten: eatenDelta,
      }, now);
      return {
        ...player,
        checkpointSeq: player.checkpointSeq + 1,
        checkpointScore: player.score,
        checkpointMass: player.mass,
        checkpointEaten: player.eaten,
        checkpointStartedAt: now,
      };
    } catch {
      return player;
    }
  }

  async readReconnectIndex() {
    const stored = await this.ctx.storage.get(RECONNECT_INDEX_KEY);
    if (!Array.isArray(stored)) return [];
    const unique = [];
    const seen = new Set();
    for (const value of stored) {
      const resumeKey = boundedResumeKey(value);
      if (!resumeKey || seen.has(resumeKey)) continue;
      seen.add(resumeKey);
      unique.push(resumeKey);
      if (unique.length >= MAX_RECONNECT_SLOTS) break;
    }
    return unique;
  }

  async writeReconnectIndex(index) {
    if (index.length === 0) {
      await this.ctx.storage.delete(RECONNECT_INDEX_KEY);
      return;
    }
    await this.ctx.storage.put(RECONNECT_INDEX_KEY, index.slice(0, MAX_RECONNECT_SLOTS));
  }

  async removeReconnectIndexKey(resumeKey) {
    const index = await this.readReconnectIndex();
    const next = index.filter((key) => key !== resumeKey);
    if (next.length !== index.length) await this.writeReconnectIndex(next);
  }

  async cleanupReconnectSlots(now) {
    const index = await this.readReconnectIndex();
    const kept = [];
    for (const resumeKey of index) {
      const key = reconnectStorageKey(resumeKey);
      const slot = await this.ctx.storage.get(key);
      if (!slot || isReconnectSlotExpired(slot, now)) {
        if (slot) await this.ctx.storage.delete(key);
        continue;
      }
      kept.push(resumeKey);
    }
    if (kept.length !== index.length) await this.writeReconnectIndex(kept);
    return kept;
  }

  async saveReconnectSlot(player, now) {
    const resumeKey = boundedResumeKey(player?.resumeKey);
    if (!resumeKey || !player?.id) return;
    const kept = await this.cleanupReconnectSlots(now);
    const slot = makeReconnectSlot(player, resumeKey, now);
    await this.ctx.storage.put(reconnectStorageKey(resumeKey), slot);
    const next = [resumeKey, ...kept.filter((key) => key !== resumeKey)].slice(0, MAX_RECONNECT_SLOTS);
    await this.writeReconnectIndex(next);
  }

  async takeReconnectSlot(resumeKey, now) {
    const normalized = boundedResumeKey(resumeKey);
    if (!normalized) return null;
    const key = reconnectStorageKey(normalized);
    const slot = await this.ctx.storage.get(key);
    if (!canResume(slot, normalized, now)) {
      if (slot && isReconnectSlotExpired(slot, now)) await this.ctx.storage.delete(key);
      await this.removeReconnectIndexKey(normalized);
      return null;
    }
    await this.ctx.storage.delete(key);
    await this.removeReconnectIndexKey(normalized);
    return slot;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const activePlayers = this.socketsWithPlayers();
    if (activePlayers.length >= MAX_PLAYERS) {
      return new Response('Room full', { status: 503 });
    }

    const url = new URL(request.url);
    const room = boundedText(url.searchParams.get('room'), 'ocean-1', 24).toLowerCase();
    const requestedName = boundedText(url.searchParams.get('name'), 'Little Fish', 20);
    const requestedResume = boundedResumeKey(url.searchParams.get('resume'));
    const requestedProfileId = boundedProfileId(url.searchParams.get('profile'));
    const requestedSkinId = skinById(url.searchParams.get('skin'))?.id || '';
    const requestedGameSessionId = boundedGameSessionId(url.searchParams.get('gameSession'));
    const now = Date.now();
    await this.cleanupReconnectSlots(now);

    let resumed = false;
    let player = null;
    if (requestedResume) {
      const slot = await this.takeReconnectSlot(requestedResume, now);
      const activeIds = new Set(activePlayers.map(({ player: active }) => active.id));
      if (slot?.id && !activeIds.has(slot.id) && String(slot.profileId || '') === requestedProfileId) {
        player = {
          ...slot,
          room,
          profileId: requestedProfileId || slot.profileId || '',
          skinId: requestedSkinId || slot.skinId || '',
          interactive: true,
          seq: Number.isSafeInteger(slot.seq) ? slot.seq : 0,
          lastAt: now,
          rate: makeRateState(),
        };
        delete player.disconnectedAt;
        resumed = true;
      }
    }

    if (!player) {
      player = {
        id: crypto.randomUUID().slice(0, 12),
        name: requestedName,
        room,
        profileId: requestedProfileId,
        skinId: requestedSkinId,
        gameSessionId: requestedGameSessionId || newSessionId(),
        checkpointSeq: 0,
        checkpointScore: 0,
        checkpointMass: START_MASS,
        checkpointEaten: 0,
        checkpointStartedAt: now,
        position: spawnPoint(),
        mass: START_MASS,
        score: 0,
        deaths: 0,
        eaten: 0,
        seq: 0,
        lastAt: now,
        rate: makeRateState(),
        interactive: true,
      };
    }

    player.resumeKey = makeResumeKey();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(player);
    server.send(JSON.stringify({
      type: 'welcome',
      v: PROTOCOL_VERSION,
      id: player.id,
      resumeKey: player.resumeKey,
      resumed,
      inputSeq: player.seq,
      room,
      bounds: WORLD_BOUNDS,
      snapshot: this.snapshot(true, true),
    }));
    this.broadcastSnapshot(true);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, rawMessage) {
    let player = ws.deserializeAttachment();
    if (!player?.id || player.interactive === false) return;

    const now = Date.now();
    const rateResult = consumeRateWindow(player.rate, now, INPUT_RATE_LIMIT, INPUT_RATE_WINDOW_MS);
    player = { ...player, rate: rateResult.state };
    ws.serializeAttachment(player);
    if (!rateResult.allowed) {
      ws.send(JSON.stringify({ type: 'error', v: PROTOCOL_VERSION, code: 'rate_limited' }));
      return;
    }

    const parsed = parseClientMessage(rawMessage);
    if (!parsed.ok) {
      this.sendError(ws, parsed.code);
      return;
    }
    const message = parsed.message;

    if (message.type === 'ping') {
      ws.send(JSON.stringify({
        type: 'pong',
        v: PROTOCOL_VERSION,
        t: message.t,
        serverTime: now,
      }));
      return;
    }

    if (!acceptSequence(player.seq, message.seq)) {
      ws.send(JSON.stringify({ type: 'error', v: PROTOCOL_VERSION, code: 'bad_seq' }));
      return;
    }

    player = advancePlayer(player, message.dir, (now - player.lastAt) / 1000, WORLD_BOUNDS);
    player.seq = message.seq;
    player.lastAt = now;

    let foodChanged = false;
    for (let i = 0; i < this.food.length; i += 1) {
      const result = collectFood(player, this.food[i]);
      if (result.eaten) {
        player = result.player;
        this.food[i] = spawnFood();
        foodChanged = true;
      }
    }

    const peers = this.socketsWithPlayers().filter(({ socket }) => socket !== ws);
    if (this.lastWildlifeStepAt === 0 || now - this.lastWildlifeStepAt >= WILDLIFE_STEP_MS) {
      const dt = this.lastWildlifeStepAt === 0 ? WILDLIFE_STEP_MS / 1000 : (now - this.lastWildlifeStepAt) / 1000;
      const activeForWildlife = [publicPlayer(player), ...peers.map(({ player: other }) => publicPlayer(other))];
      this.wildlife = stepWildlife(this.wildlife, activeForWildlife, dt, WORLD_BOUNDS, now);
      this.lastWildlifeStepAt = now;
      this.wildlifeDirty = true;
    }

    let playerWasEaten = false;
    for (let i = 0; i < this.wildlife.length; i += 1) {
      const actor = this.wildlife[i];
      const winner = resolveEatPair(player, actor);
      if (winner === 'a') {
        player = {
          ...player,
          mass: player.mass + actor.mass * 0.7,
          score: player.score + Math.max(1, Math.round(actor.mass * 100)),
          eaten: Math.max(0, Number(player.eaten || 0)) + 1,
        };
        this.wildlife[i] = respawnWildlife(actor, spawnPoint);
        this.wildlifeDirty = true;
      } else if (winner === 'b') {
        player = await this.settleCheckpoint(player, now);
        player = {
          ...respawnPlayer(player, spawnPoint()),
          eaten: 0,
          checkpointScore: 0,
          checkpointMass: START_MASS,
          checkpointEaten: 0,
          checkpointStartedAt: now,
        };
        player.lastAt = now;
        playerWasEaten = true;
        ws.send(JSON.stringify({
          type: 'eaten',
          v: PROTOCOL_VERSION,
          by: actor.name || 'Abyss predator',
        }));
        break;
      }
    }

    if (!playerWasEaten) {
      const buckets = buildSpatialBuckets(peers, COLLISION_CELL_SIZE, (entry) => entry.player.position);
      const nearbyPeers = nearbyFromBuckets(buckets, player.position, COLLISION_CELL_SIZE);
      const playerRadius = radiusForMass(player.mass);
      const oversizedPeers = peers.filter(({ player: other }) => {
        const otherRadius = radiusForMass(other.mass);
        const maxReach = Math.max(
          playerRadius + otherRadius * 0.35,
          otherRadius + playerRadius * 0.35,
        );
        return maxReach > COLLISION_CELL_SIZE;
      });
      const candidates = [...new Set([...nearbyPeers, ...oversizedPeers])]
        .sort((a, b) => String(a.player.id).localeCompare(String(b.player.id)));

      for (const peer of candidates) {
        let other = peer.socket.deserializeAttachment();
        if (!other?.id || other.interactive === false) continue;
        const winner = resolveEatPair(player, other);

        if (winner === 'a') {
          player = {
            ...player,
            mass: player.mass + other.mass * 0.7,
            score: player.score + Math.max(1, Math.round(other.mass * 100)),
            eaten: Math.max(0, Number(player.eaten || 0)) + 1,
          };
          other = await this.settleCheckpoint(other, now);
          other = {
            ...respawnPlayer(other, spawnPoint()),
            eaten: 0,
            checkpointScore: 0,
            checkpointMass: START_MASS,
            checkpointEaten: 0,
            checkpointStartedAt: now,
          };
          other.lastAt = now;
          peer.socket.serializeAttachment(other);
          peer.socket.send(JSON.stringify({
            type: 'eaten',
            v: PROTOCOL_VERSION,
            by: player.name,
          }));
        } else if (winner === 'b') {
          other = {
            ...other,
            mass: other.mass + player.mass * 0.7,
            score: other.score + Math.max(1, Math.round(player.mass * 100)),
            eaten: Math.max(0, Number(other.eaten || 0)) + 1,
          };
          peer.socket.serializeAttachment(other);
          player = await this.settleCheckpoint(player, now);
          player = {
            ...respawnPlayer(player, spawnPoint()),
            eaten: 0,
            checkpointScore: 0,
            checkpointMass: START_MASS,
            checkpointEaten: 0,
            checkpointStartedAt: now,
          };
          player.lastAt = now;
          playerWasEaten = true;
          ws.send(JSON.stringify({
            type: 'eaten',
            v: PROTOCOL_VERSION,
            by: other.name,
          }));
        }
        if (playerWasEaten) break;
      }
    }

    ws.serializeAttachment(player);
    if (foodChanged) {
      this.foodDirty = true;
      await this.ctx.storage.put('food', this.food);
    }
    this.broadcastSnapshot(false);
  }

  async detachPlayer(ws) {
    let player = ws.deserializeAttachment();
    if (!player?.id || player.interactive === false) return;
    const now = Date.now();
    player = await this.settleCheckpoint(player, now);
    const detached = { ...player, interactive: false };
    ws.serializeAttachment(detached);
    await this.saveReconnectSlot(detached, now);
    this.broadcastSnapshot(true);
  }

  async webSocketClose(ws) {
    await this.detachPlayer(ws);
  }

  async webSocketError(ws) {
    await this.detachPlayer(ws);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        service: 'abyss-eater',
        version: VERSION,
        protocolVersion: PROTOCOL_VERSION,
        realtime: 'durable-objects',
        roomPoolSize: ROOM_POOL_SIZE,
        snapshotHzCap: Math.round(1000 / SNAPSHOT_MIN_INTERVAL_MS),
        wildlifePerRoom: WILDLIFE_COUNT,
        persistence: persistenceReady(env) ? 'configured' : 'unavailable',
      });
    }

    if (url.pathname === '/api/session' || url.pathname === '/api/session/guest') {
      return handleSessionApi(request, env);
    }

    if (url.pathname === '/api/profile') {
      return handleProfileApi(request, env);
    }

    if (url.pathname === '/api/leaderboard') {
      return handleLeaderboardApi(request, env, url);
    }

    if (url.pathname === '/api/skins') {
      return handleSkinsApi(request, env);
    }

    if (url.pathname === '/api/shop/purchase' || url.pathname === '/api/skins/buy') {
      return handleShopPurchaseApi(request, env);
    }

    if (url.pathname === '/api/profile/skin' || url.pathname === '/api/skins/select') {
      return handleSelectSkinApi(request, env);
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }
      const roomLabel = boundedText(url.searchParams.get('room'), 'ocean', 24);
      const room = roomIdFor(roomLabel, ROOM_POOL_SIZE);
      const sessionToken = url.searchParams.get('session') || '';
      url.searchParams.delete('session');
      url.searchParams.delete('profile');
      url.searchParams.delete('skin');
      url.searchParams.delete('gameSession');
      const profile = await profileForSessionToken(sessionToken, env);
      const gameSessionId = newSessionId();
      if (profile?.id) {
        url.searchParams.set('profile', profile.id);
        if (skinById(profile.selectedSkinId)) url.searchParams.set('skin', profile.selectedSkinId);
      }
      url.searchParams.set('gameSession', gameSessionId);
      url.searchParams.set('room', room);
      const stub = env.GAME_ROOM.getByName(room);
      return stub.fetch(new Request(url.toString(), request));
    }

    const asset = ASSETS[url.pathname];
    if (asset) {
      return new Response(asset.body, { headers: securityHeaders(asset.contentType) });
    }

    return new Response('Not Found', { status: 404, headers: securityHeaders('text/plain; charset=utf-8') });
  },
};