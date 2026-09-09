# Multiplayer Hardening Runbook

This runbook describes the public-alpha realtime and delivery contract for the authoritative `GameRoom` Durable Object and branded Cloudflare gateway.

## Runtime contract

- Protocol version: `v = 2` on every gameplay WebSocket message.
- Public room cap: 20 active players.
- Public room labels map deterministically into a fixed pool of 64 Durable Object names (`ocean-1` through `ocean-64`).
- Client input target: 10 Hz.
- Per-socket flood guard: 25 messages per rolling 1000 ms window. The 26th message in the same window is rejected with `rate_limited` and performs no simulation work.
- Input sequence numbers must be non-negative safe integers and strictly increase for a connection. Rejected/stale input returns `bad_seq`.
- Movement, bounds, food collection, player collision/eating, mass, score and respawn remain server-authoritative.
- Collision candidates are spatially bounded and resolved deterministically. Once the local fish is eaten and respawned, that input's local collision pass stops.
- Room broadcasts are coalesced to a minimum 50 ms interval, capping ordinary snapshots at 20 Hz.
- Protocol v2 snapshots always contain players but may omit `food` when unchanged. The client keeps its previous food state until a later food-bearing snapshot arrives.
- Durable Objects do not run a perpetual simulation timer; activity is driven by joins, messages and disconnects so WebSocket Hibernation can remain effective.

## Reconnect contract

On join, the server issues a fresh opaque `resumeKey`. The browser stores it in room-label-scoped `sessionStorage` at `abyss-eater-resume:<room-label>`. A reconnect within 12 seconds can present that key through the `resume` query parameter.

A disconnected fish is converted into a non-interactive reconnect slot. It cannot move, eat, be eaten or count toward the active 20-player cap while disconnected. Valid resume preserves identity, position, mass, score and deaths, rotates the resume key, and returns the previous input sequence so the client continues with a strictly increasing sequence. Expired or invalid resume keys create a fresh player instead.

Reconnect storage is bounded to at most `MAX_PLAYERS * 2` indexed slots. Cleanup is event-driven; there is no periodic Durable Object timer.

## Protocol messages

Client to server:

```json
{"type":"input","v":2,"seq":42,"dir":{"x":0.2,"y":0,"z":-0.8}}
{"type":"ping","v":2,"t":1788944400000}
```

Server to client includes `v: 2` for `welcome`, `snapshot`, `pong`, `eaten` and `error`. `welcome` includes `resumeKey`, `resumed` and `inputSeq`. `/health` is HTTP JSON and exposes `version: "0.3.0"`, `protocolVersion: 2`, `roomPoolSize: 64` and `snapshotHzCap: 20`.

Protocol v2 is intentionally incompatible with v1 because v2 permits player-only snapshot deltas. An old browser must fail closed and reload instead of silently discarding those snapshots.

## Delivery contract

- Authoritative Worker: `abyss-eater`, account `trinhtanphat6666` (`6c5207813df3d5b83b9508125e0e9e12`).
- Durable Object: `GAME_ROOM -> GameRoom`, preserving existing SQLite migration tag `v1`.
- Origin: `abyss-eater.hikvision.workers.dev`.
- Branded gateway: `abyss-eater-gateway`, account `trinhtanphat2403` (`50afb4fd3c4c7a1f3e1bdb7f22d4af7f`).
- Branded domain: `abyss-eater.qs3d.site`.
- `wrangler.gateway.jsonc` serves `./public` through Workers Static Assets and runs gateway code first only for `/ws` and `/health`.
- Static routes are served from the branded account; `/ws` and `/health` proxy to the authoritative origin.
- Wrangler is pinned to `4.129.1` in the deploy scripts.

Deploy authoritative compute before the gateway:

```bash
npm run deploy:game
npm run deploy:gateway
```

No paid Cloudflare product or paid-plan setting is enabled by these changes.

## PWA contract

The app manifest supplies standalone metadata plus 192 and 512 install icons. The service worker precaches the same-origin shell and provides cached navigation fallback. Multiplayer and the externally hosted Three.js module still require network access for full gameplay.

## Release qualification

Before merge/deploy, require all of the following on the exact candidate head:

```bash
npm test
npm run build
node --check dist/worker.mjs
git diff --check
```

GitHub Actions must show the Node 22 `test-and-build` job green. Do not merge red or pending CI.

After deployment, verify at minimum:

1. Branded `/` returns the public-alpha shell.
2. `/manifest.webmanifest`, `/sw.js`, `/icon-192.svg`, `/icon-512.svg`, and `/client-input.mjs` return successfully from the branded domain.
3. Branded `/health` reports `0.3.0`, protocol `2`, pool `64`, snapshot cap `20`.
4. WebSocket join returns a v2 `welcome`; ping/pong works.
5. Movement input is accepted with increasing sequence numbers.
6. A second connection sees multiplayer snapshots and player eating/respawn remains authoritative.
7. A reconnect within 12 seconds resumes the same fish and continues the previous input sequence.

## Rollback

If protocol v2 or delivery routing causes a production regression, deploy the previously verified game Worker version first and then restore the previously verified gateway version. Do not rewrite Durable Object migration history or delete room storage. After rollback, verify `/health`, static shell delivery, WebSocket join/ping, and active deployment percentage before considering rollback complete.
