import { DurableObject } from 'cloudflare:workers';

/*__GAME_LOGIC__*/
/*__PROTOCOL__*/

const ASSETS = /*__ASSETS__*/;
const WORLD_BOUNDS = { x: 80, y: 28, z: 80 };
const MAX_PLAYERS = 20;
const FOOD_COUNT = 42;
const FOOD_VALUE = 0.2;
const VERSION = '0.1.0';

function boundedText(value, fallback, maxLength) {
  const normalized = String(value ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || fallback).slice(0, maxLength);
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
    'content-security-policy': "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  };
}

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.food = [];
    this.snapshotSeq = 0;
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get('food');
      this.food = Array.isArray(stored) && stored.length ? stored : makeFood();
      if (!stored) await this.ctx.storage.put('food', this.food);
    });
  }

  socketsWithPlayers() {
    return this.ctx.getWebSockets()
      .map((socket) => ({ socket, player: socket.deserializeAttachment() }))
      .filter(({ player }) => player?.id);
  }

  snapshot() {
    return {
      type: 'snapshot',
      seq: ++this.snapshotSeq,
      serverTime: Date.now(),
      players: this.socketsWithPlayers().map(({ player }) => publicPlayer(player)),
      food: this.food,
    };
  }

  broadcastSnapshot() {
    const payload = JSON.stringify(this.snapshot());
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
  }

  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) {
      return new Response('Room full', { status: 503 });
    }

    const url = new URL(request.url);
    const room = boundedText(url.searchParams.get('room'), 'ocean-1', 24);
    const name = boundedText(url.searchParams.get('name'), 'Little Fish', 20);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    const player = {
      id: crypto.randomUUID().slice(0, 12),
      name,
      room,
      position: spawnPoint(),
      mass: START_MASS,
      score: 0,
      deaths: 0,
      seq: 0,
      lastAt: Date.now(),
    };
    server.serializeAttachment(player);
    server.send(JSON.stringify({
      type: 'welcome',
      id: player.id,
      room,
      bounds: WORLD_BOUNDS,
      snapshot: this.snapshot(),
    }));
    this.broadcastSnapshot();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, rawMessage) {
    if (typeof rawMessage !== 'string' || rawMessage.length > 1024) {
      ws.send(JSON.stringify({ type: 'error', code: 'bad_message' }));
      return;
    }

    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      ws.send(JSON.stringify({ type: 'error', code: 'bad_json' }));
      return;
    }

    if (message?.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', t: Number(message.t) || 0, serverTime: Date.now() }));
      return;
    }

    if (message?.type !== 'input') {
      ws.send(JSON.stringify({ type: 'error', code: 'bad_type' }));
      return;
    }

    let player = ws.deserializeAttachment();
    if (!player?.id) return;
    const now = Date.now();
    const seq = Number.isSafeInteger(message.seq) ? message.seq : player.seq + 1;
    if (seq <= player.seq) return;

    player = advancePlayer(player, message.dir, (now - player.lastAt) / 1000, WORLD_BOUNDS);
    player.seq = seq;
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
    for (const peer of peers) {
      let other = peer.socket.deserializeAttachment();
      if (!other?.id) continue;

      if (canEat(player, other)) {
        player = {
          ...player,
          mass: player.mass + other.mass * 0.7,
          score: player.score + Math.max(1, Math.round(other.mass * 100)),
        };
        other = respawnPlayer(other, spawnPoint());
        other.lastAt = now;
        peer.socket.serializeAttachment(other);
        peer.socket.send(JSON.stringify({ type: 'eaten', by: player.name }));
      } else if (canEat(other, player)) {
        other = {
          ...other,
          mass: other.mass + player.mass * 0.7,
          score: other.score + Math.max(1, Math.round(player.mass * 100)),
        };
        peer.socket.serializeAttachment(other);
        player = respawnPlayer(player, spawnPoint());
        player.lastAt = now;
        ws.send(JSON.stringify({ type: 'eaten', by: other.name }));
      }
    }

    ws.serializeAttachment(player);
    if (foodChanged) await this.ctx.storage.put('food', this.food);
    this.broadcastSnapshot();
  }

  webSocketClose() {
    this.broadcastSnapshot();
  }

  webSocketError() {}
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'abyss-eater', version: VERSION, realtime: 'durable-objects' });
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }
      const room = boundedText(url.searchParams.get('room'), 'ocean-1', 24).toLowerCase();
      const stub = env.GAME_ROOM.getByName(room);
      return stub.fetch(request);
    }

    const asset = ASSETS[url.pathname];
    if (asset) {
      return new Response(asset.body, { headers: securityHeaders(asset.contentType) });
    }

    return new Response('Not Found', { status: 404, headers: securityHeaders('text/plain; charset=utf-8') });
  },
};
