import { DurableObject } from 'cloudflare:workers';

/*__GAME_LOGIC__*/
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
  return jsonApi({ ok: false, code: 'persistence_unavailable' }, 503);
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

function persistenceReady(env) {
  return Boolean(env?.DB && typeof env.DB.prepare === 'function' && typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 16);
}

async function authenticatedProfile(request, env, now = Date.now()) {
  if (!persistenceReady(env)) return { response: persistenceUnavailable() };
  const token = bearerFromRequest(request);
  if (!token) return { response: jsonApi({ ok: false, code: 'unauthorized' }, 401) };
  const session = await verifySession(token, env.SESSION_SECRET, now);
  if (!session) return { response: jsonApi({ ok: false, code: 'unauthorized' }, 401) };
  try {
    const profile = await readProfile(env.DB, session.profileId);
    if (!profile || profile.status !== 'active' || profile.sessionVersion !== session.version) {
      return { response: jsonApi({ ok: false, code: 'unauthorized' }, 401) };
    }
    return { session, profile };
  } catch {
    return { response: persistenceUnavailable() };
  }
}

async function handleSessionApi(request, env) {
  if (request.method !== 'POST') return jsonApi({ ok: false, code: 'method_not_allowed' }, 405);
  if (!persistenceReady(env)) return persistenceUnavailable();
  const body = await readSmallJson(request);
  if (!body) return jsonApi({ ok: false, code: 'invalid_request' }, 400);
  const now = Date.now();

  try {
    let profile = null;
    const existingToken = bearerFromRequest(request);
    if (existingToken) {
      const session = await verifySession(existingToken, env.SESSION_SECRET, now);
      if (session) {
        const existing = await readProfile(env.DB, session.profileId);
        if (existing?.status === 'active' && existing.sessionVersion === session.version) profile = existing;
      }
    }

    if (!profile) {
      profile = await createGuestProfile(env.DB, body.displayName, now, crypto.randomUUID());
    }

    const ownedSkins = await readOwnedSkins(env.DB, profile.id);
    const token = await signSession({
      profileId: profile.id,
      version: profile.sessionVersion,
      expiresAt: now + SESSION_TTL_MS,
    }, env.SESSION_SECRET, now);
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
    const ownedSkins = await readOwnedSkins(env.DB, auth.profile.id);
    return jsonApi({ ok: true, profile: auth.profile, ownedSkins, catalog: SKIN_CATALOG });
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
    this.snapshotSeq = 0;
    this.lastBroadcastAt = 0;
    this.foodDirty = true;
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

  snapshot(includeFood = false) {
    const value = {
      type: 'snapshot',
      v: PROTOCOL_VERSION,
      seq: ++this.snapshotSeq,
      serverTime: Date.now(),
      players: this.socketsWithPlayers().map(({ player }) => publicPlayer(player)),
    };
    if (includeFood) value.food = this.food;
    return value;
  }

  broadcastSnapshot(force = false) {
    const now = Date.now();
    if (!force && !shouldBroadcast(this.lastBroadcastAt, now, SNAPSHOT_MIN_INTERVAL_MS)) return false;
    const includeFood = this.foodDirty;
    const payload = JSON.stringify(this.snapshot(includeFood));
    for (const { socket } of this.socketsWithPlayers()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
    this.lastBroadcastAt = now;
    if (includeFood) this.foodDirty = false;
    return true;
  }

  sendError(ws, code) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', v: PROTOCOL_VERSION, code }));
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
    const now = Date.now();
    await this.cleanupReconnectSlots(now);

    let resumed = false;
    let player = null;
    if (requestedResume) {
      const slot = await this.takeReconnectSlot(requestedResume, now);
      const activeIds = new Set(activePlayers.map(({ player: active }) => active.id));
      if (slot?.id && !activeIds.has(slot.id)) {
        player = {
          ...slot,
          room,
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
        position: spawnPoint(),
        mass: START_MASS,
        score: 0,
        deaths: 0,
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
      snapshot: this.snapshot(true),
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

    let playerWasEaten = false;
    for (const peer of candidates) {
      let other = peer.socket.deserializeAttachment();
      if (!other?.id || other.interactive === false) continue;
      const winner = resolveEatPair(player, other);

      if (winner === 'a') {
        player = {
          ...player,
          mass: player.mass + other.mass * 0.7,
          score: player.score + Math.max(1, Math.round(other.mass * 100)),
        };
        other = respawnPlayer(other, spawnPoint());
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
        };
        peer.socket.serializeAttachment(other);
        player = respawnPlayer(player, spawnPoint());
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

    ws.serializeAttachment(player);
    if (foodChanged) {
      this.foodDirty = true;
      await this.ctx.storage.put('food', this.food);
    }
    this.broadcastSnapshot(false);
  }

  async detachPlayer(ws) {
    const player = ws.deserializeAttachment();
    if (!player?.id || player.interactive === false) return;
    const detached = { ...player, interactive: false };
    ws.serializeAttachment(detached);
    await this.saveReconnectSlot(detached, Date.now());
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
      });
    }

    if (url.pathname === '/api/session') {
      return handleSessionApi(request, env);
    }

    if (url.pathname === '/api/profile') {
      return handleProfileApi(request, env);
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }
      const roomLabel = boundedText(url.searchParams.get('room'), 'ocean', 24);
      const room = roomIdFor(roomLabel, ROOM_POOL_SIZE);
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