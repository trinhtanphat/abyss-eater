# Abyss Eater

**Abyss Eater: Ocean Survival** is a browser-first 3D multiplayer fish survival game. Start small, collect plankton, eat smaller fish, grow in mass, and avoid predators that are larger than you.

## MVP

- Procedural 3D ocean built with Three.js 0.185.1.
- Desktop controls: WASD / arrow keys, Space to swim up, Shift to swim down.
- Touch controls for phones and tablets.
- Server-authoritative movement, world bounds, food collection, player eating, score and respawn.
- One Cloudflare Durable Object per ocean room.
- WebSocket Hibernation API; no perpetual Durable Object game-loop timer.
- 20-player room target for the initial release.
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
       | room name
       v
Durable Object: GameRoom
  - player state attachments
  - food state storage
  - movement authority
  - collision/eating
  - snapshot broadcast
```

The client renders at display refresh rate and sends movement intent at 10 Hz. Clients never send authoritative position, mass, score, or collision results.

## Local validation

Node.js 22 or newer is required.

```bash
npm test
npm run build
npm run check
```

The production bundle is written to `dist/worker.mjs`.

## Cloudflare

The authoritative game Worker is `abyss-eater` in account `trinhtanphat6666` (`6c5207813df3d5b83b9508125e0e9e12`). `wrangler.jsonc` declares a SQLite-backed Durable Object binding named `GAME_ROOM` using the `GameRoom` class. Its origin is `https://abyss-eater.hikvision.workers.dev`.

The `qs3d.site` zone lives in `trinhtanphat2403`, so production uses a thin Worker named `abyss-eater-gateway` in that account instead of an invalid cross-account CNAME. `wrangler.gateway.jsonc` binds that gateway to `https://abyss-eater.qs3d.site`; `gateway/worker.mjs` transparently forwards HTTP and WebSocket upgrade requests to the authoritative Worker in `trinhtanphat6666`. No gameplay state is stored in the gateway.

## MVP scope intentionally deferred

Accounts, persistent leaderboards, skins, shops, chat, parties, regional matchmaking, binary snapshots and external 3D models are intentionally deferred until the core gameplay loop is validated.
