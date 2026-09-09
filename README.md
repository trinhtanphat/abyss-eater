# Abyss Eater

**Abyss Eater: Ocean Survival** is a browser-first 3D multiplayer fish survival game. Start small, collect plankton, eat smaller fish, grow in mass, and avoid predators that are larger than you.

## Public alpha

- Procedural 3D ocean built with Three.js 0.185.1.
- Desktop controls: pointer-lock mouse look, camera-relative WASD / arrow keys, Space to swim up, Shift to swim down.
- Touch controls for phones and tablets.
- Server-authoritative movement, world bounds, food collection, player eating, score and respawn.
- Protocol `v=1` with strict message validation and monotonic input sequences.
- Per-socket flood guard: 25 messages per 1000 ms window.
- Spatially bounded, deterministic player collision candidates.
- 12-second transient reconnect grace using a rotated opaque room-scoped resume key in `sessionStorage`.
- Disconnected reconnect slots are non-interactive and do not count toward the 20-player active room cap.
- WebSocket Hibernation API; no perpetual Durable Object game-loop timer.
- Dependency-free Node build and test pipeline.

## Architecture

```text
Browser / Three.js
       |
       | HTTPS / WebSocket
       v
abyss-eater.qs3d.site
Gateway Worker (trinhtanphat2403)
       |
       | transparent fetch proxy
       v
abyss-eater.hikvision.workers.dev
Game Worker (trinhtanphat6666)
       |
       | authoritative room
       v
Durable Object: GameRoom
  - WebSocket player attachments
  - bounded reconnect slots
  - food state storage
  - movement authority
  - spatial collision/eating
  - versioned snapshots
```

The client renders at display refresh rate and sends movement intent at 10 Hz. Clients never send authoritative position, mass, score, or collision results. Every gameplay WebSocket message carries protocol version `1`; the server rejects malformed, stale, incompatible, or flood traffic before applying simulation work.

## Reconnect behavior

A successful `welcome` rotates and returns a `resumeKey` plus the current `inputSeq`. The browser stores the key as `abyss-eater-resume:<room>` in `sessionStorage`. Reconnecting to the same room within 12 seconds can resume the same fish identity, position, mass, score and deaths without allowing the disconnected fish to interact while offline.

See `docs/runbooks/multiplayer-hardening.md` for the exact protocol, rate, reconnect, release and rollback contract.

## Local validation

Node.js 22 or newer is required.

```bash
npm test
npm run build
node --check dist/worker.mjs
```

The production bundle is written to `dist/worker.mjs`. CI runs the same Node 22 tests and production build on pull requests and `main`.

## Cloudflare

The authoritative game Worker is `abyss-eater` in account `trinhtanphat6666` (`6c5207813df3d5b83b9508125e0e9e12`). `wrangler.jsonc` declares a SQLite-backed Durable Object binding named `GAME_ROOM` using the `GameRoom` class. Its origin is `https://abyss-eater.hikvision.workers.dev`.

The `qs3d.site` zone lives in `trinhtanphat2403`, so production uses a thin Worker named `abyss-eater-gateway` in that account instead of an invalid cross-account CNAME. `wrangler.gateway.jsonc` binds that gateway to `https://abyss-eater.qs3d.site`; `gateway/worker.mjs` transparently forwards HTTP and WebSocket upgrade requests to the authoritative Worker in `trinhtanphat6666`. No gameplay state is stored in the gateway.

`/health` reports application version `0.2.0`, protocol version `1`, and Durable Object realtime mode after Carrier 1 is deployed.

No paid Cloudflare product is required or enabled by the multiplayer-hardening carrier.

## Public-alpha work still intentionally separate

Installable/offline PWA assets, Workers Static Assets routing on the branded gateway, bounded public room-name allocation, snapshot coalescing/delta delivery, GPU resource reuse, production live probes, accounts, persistent leaderboards, skins, shops, chat, parties, regional matchmaking, binary snapshots, AI biomes/bosses and external 3D models are kept as separate carriers so each can be tested, reviewed and rolled back independently.