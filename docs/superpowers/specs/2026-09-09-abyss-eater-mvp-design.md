# Abyss Eater MVP Design

## Goal

Ship a playable 3D browser multiplayer prototype of **Abyss Eater: Ocean Survival** where players swim through a shared ocean, eat food and smaller players, grow in mass, and respawn after being eaten.

## Product scope

The MVP is a web-first PWA-style experience optimized for desktop browsers with basic touch controls. It deliberately excludes accounts, payments, skins, persistent leaderboards, chat, parties, and matchmaking across regions. Those can be added after the core game loop is proven.

## Architecture

- **Client:** plain browser ES modules, HTML/CSS, and Three.js `0.185.1` loaded from jsDelivr. The client renders at display refresh rate, samples input at 10 Hz, and interpolates server snapshots.
- **Edge entrypoint:** a Cloudflare Worker serves the built-in static assets, exposes `/health`, and routes WebSocket upgrades at `/ws` to a room Durable Object.
- **Game room:** one SQLite-backed Durable Object class `GameRoom` per room name. It owns player positions, velocity intent, mass, food state, collision/eating decisions, and snapshots.
- **Realtime:** WebSocket Hibernation API (`ctx.acceptWebSocket`) with no perpetual timers. State advances on player input and connection events using elapsed monotonic timestamps; this lets idle rooms hibernate.
- **Authority:** clients send only desired normalized movement. The room clamps speed and world bounds and is the only authority allowed to decide food collection, player-vs-player eating, mass changes, respawns, and scores.

## Game model

World bounds are a 3D box. Every player starts at mass `1`. Radius is derived from the cube root of mass. Movement speed falls gradually as mass rises. Food has fixed mass value and respawns deterministically after collection. A player can eat another player only when its mass is at least 15% larger and the center distance is inside an eating threshold derived from radii. The eaten player respawns at starter mass and a new spawn point.

## Network protocol

Client to server messages are JSON:

- `{"type":"input","seq":N,"dir":{"x":-1..1,"y":-1..1,"z":-1..1}}`
- `{"type":"ping","t":number}`

Server messages are JSON:

- `welcome`: client id, room, world bounds and initial snapshot
- `snapshot`: sequence, server timestamp, players, food
- `pong`: echoed client timestamp
- `error`: protocol validation failure

Snapshots are compact enough for the initial 20-player target; binary encoding is deferred until profiling proves JSON is a bottleneck.

## Rendering and UX

The ocean uses procedural geometry only: fish bodies are ellipsoids with tail fins, food is glowing plankton, and fog/lighting creates depth without external 3D assets. The local fish is followed by a third-person camera that zooms out with mass. HUD shows mass, score, online player count, room and latency. Keyboard controls use WASD/arrows plus Space/Shift for vertical motion; touch users get an on-screen directional pad and vertical buttons.

## Reliability and security

Input payload size and schema are validated. Names and room identifiers are sanitized and length-limited. The server clamps normalized input, delta time, movement speed and world bounds. A client cannot directly set mass, position, score or declare a collision. Unknown HTTP paths return 404. Security headers are set on static responses.

## Testing

Pure game rules live in `src/game-logic.mjs` and are covered by Node's built-in test runner. Build tests verify production Worker assembly includes required routes and embedded assets. The GitHub Actions workflow runs `npm test` and `npm run build` on Node 22.

## Deployment

Production Worker name: `abyss-eater` in Cloudflare account `trinhtanphat6666` (`6c5207813df3d5b83b9508125e0e9e12`). Initial public URL is the account's `workers.dev` hostname. The `qs3d.site` zone is owned by a different Cloudflare account (`trinhtanphat2403`), so the MVP must not create a cross-account CNAME or pretend a Worker Custom Domain can be attached there. A branded custom domain is deferred until the Worker and zone are co-located in one account or Cloudflare for SaaS is intentionally configured.

## Cost constraint

Use only Cloudflare Free-plan-compatible components for this MVP. Do not enable a paid Workers plan, Cloudflare for SaaS, or any other billable product as part of this implementation.
