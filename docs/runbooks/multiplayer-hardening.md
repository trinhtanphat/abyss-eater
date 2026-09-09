# Multiplayer Hardening Runbook

Abyss Eater Carrier 1 establishes the public-alpha realtime contract for the authoritative `GameRoom` Durable Object.

## Runtime contract

- Protocol version: `v = 1` on every gameplay WebSocket message.
- Public room cap: 20 active players.
- Client input target: 10 Hz.
- Per-socket flood guard: 25 messages per rolling 1000 ms window. The 26th message in the same window is rejected with `rate_limited` and performs no simulation work.
- Input sequence numbers must be non-negative safe integers and strictly increase for a connection. Rejected/stale input returns `bad_seq`.
- Movement, bounds, food collection, player collision/eating, mass, score and respawn remain server-authoritative.
- Collision candidates are spatially bounded and resolved deterministically.
- Durable Objects do not run a perpetual simulation timer; activity is driven by joins, messages and disconnects so WebSocket Hibernation can remain effective.

## Reconnect contract

On join, the server issues a fresh opaque `resumeKey`. The browser stores it in room-scoped `sessionStorage` at `abyss-eater-resume:<room>`. A reconnect within 12 seconds can present that key through the `resume` query parameter.

A disconnected fish is converted into a non-interactive reconnect slot. It cannot move, eat, be eaten or count toward the active 20-player cap while disconnected. Valid resume preserves identity, position, mass, score and deaths, rotates the resume key, and returns the previous input sequence so the client continues with a strictly increasing sequence. Expired or invalid resume keys create a fresh player instead.

Reconnect storage is bounded to at most `MAX_PLAYERS * 2` indexed slots. Cleanup is event-driven; there is no periodic Durable Object timer.

## Protocol messages

Client to server:

```json
{"type":"input","v":1,"seq":42,"dir":{"x":0.2,"y":0,"z":-0.8}}
{"type":"ping","v":1,"t":1788944400000}
```

Server to client includes `v: 1` for `welcome`, `snapshot`, `pong`, `eaten` and `error`. `welcome` includes `resumeKey`, `resumed` and `inputSeq`. `/health` is HTTP JSON and exposes `version: "0.2.0"` plus `protocolVersion: 1`.

## Release qualification

Before merge/deploy, require all of the following on the exact candidate head:

```bash
npm test
npm run build
node --check dist/worker.mjs
git diff --check
```

GitHub Actions must show the Node 22 `test-and-build` job green. Do not merge red or pending CI.

Production deployment target remains Worker `abyss-eater` in Cloudflare account `trinhtanphat6666` (`6c5207813df3d5b83b9508125e0e9e12`) with `GAME_ROOM -> GameRoom` and the existing SQLite Durable Object migration lineage. The branded `abyss-eater.qs3d.site` gateway remains stateless on account `trinhtanphat2403`.

No paid Cloudflare product is required or enabled by Carrier 1.

## Rollback

If the new protocol causes a production regression, redeploy the previously verified Worker version rather than mutating Durable Object storage or migration history. The gateway should stay unchanged unless the origin contract itself changed. After rollback, verify `/health`, WebSocket join/ping and the active deployment percentage before reopening traffic changes.