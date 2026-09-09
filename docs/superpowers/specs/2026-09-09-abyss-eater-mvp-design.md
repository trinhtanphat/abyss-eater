# Abyss Eater MVP Design

## Goal

Ship a playable 3D browser multiplayer prototype of **Abyss Eater: Ocean Survival** where players swim through a shared ocean, eat food and smaller players, grow in mass, and respawn after being eaten.

## Product scope

The MVP is a web-first installable PWA experience optimized for desktop browsers with touch controls. It deliberately excludes accounts, payments, skins, persistent leaderboards, chat, parties, regional matchmaking, AI biomes/bosses, and external 3D models. Those can be added after the public-alpha networking and delivery baseline is proven.

## Architecture

- **Client:** browser ES modules, HTML/CSS, and Three.js `0.185.1` loaded from jsDelivr. The client renders at display refresh rate, samples input at 10 Hz, interpolates server snapshots, preserves unchanged food across delta snapshots, and uses shared render resources to avoid churn.
- **Branded static entrypoint:** `abyss-eater.qs3d.site` is hosted on Cloudflare account `trinhtanphat2403` through Workers Static Assets. Static files do not need to traverse the authoritative game Worker.
- **Gateway Worker:** `abyss-eater-gateway` on `trinhtanphat2403` runs only for `/ws` and `/health` and transparently proxies those requests to `abyss-eater.hikvision.workers.dev`.
- **Authoritative game Worker:** `abyss-eater` on Cloudflare account `trinhtanphat6666` owns `/health`, `/ws`, the `GAME_ROOM` binding, and the existing SQLite-backed `GameRoom` Durable Object migration lineage.
- **Game room:** public room labels are deterministically hashed into a fixed 64-room Durable Object pool. A room owns active player state, reconnect slots, food state, collision/eating decisions, and snapshots.
- **Realtime:** WebSocket Hibernation API (`ctx.acceptWebSocket`) with no perpetual server timer. State advances on player input and connection events, allowing idle rooms to hibernate.
- **Authority:** clients send only desired movement. The room clamps movement and world bounds and is the sole authority for food collection, player eating, mass, score, respawn and reconnect state.
- **PWA:** manifest, install icons and service worker provide an installable same-origin application shell. Full multiplayer gameplay remains online-first.

## Game model

World bounds are a 3D box. Every player starts at mass `1`. Radius is derived from the cube root of mass. Movement speed falls gradually as mass rises. Food has a fixed mass value and respawns after collection. A player can eat another player only when its mass is at least 15% larger and the center distance is inside an eating threshold derived from radii. The eaten player respawns at starter mass and a new spawn point. The local collision pass ends immediately after the local fish is eaten so a fresh respawn cannot be consumed repeatedly in one input event.

## Network protocol

Public alpha uses protocol version `2` on every gameplay WebSocket message.

Client to server:

- `{"type":"input","v":2,"seq":N,"dir":{"x":-1..1,"y":-1..1,"z":-1..1}}`
- `{"type":"ping","v":2,"t":number}`

Server to client:

- `welcome`: client id, canonical room, world bounds, `resumeKey`, `resumed`, `inputSeq`, and a full initial snapshot
- `snapshot`: sequence, server timestamp, players, and optional food when food changed
- `pong`: echoed client timestamp
- `eaten`: authoritative predator notification
- `error`: protocol validation failure

Ordinary room snapshots are coalesced to a minimum 50 ms interval, giving a 20 Hz cap. Food is omitted when unchanged, reducing repeated payload size. Protocol v2 is intentionally incompatible with the previous v1 full-food assumption; stale clients fail closed on a version mismatch.

Binary encoding remains deferred until profiling proves JSON is a bottleneck.

## Room allocation and abuse bounds

Browser-supplied room labels are sanitized for display/reconnect scoping, but they do not become arbitrary Durable Object names. `roomIdFor()` maps labels into `ocean-1` through `ocean-64`, preventing public users from manufacturing an unbounded number of room Durable Objects. Active players remain capped at 20 per room.

Each socket is limited to 25 messages in a 1000 ms window. Input sequences must be safe integers and strictly increase. Reconnect state is non-interactive, bounded to `MAX_PLAYERS * 2` indexed slots, expires after 12 seconds, and is cleaned up by normal events rather than a timer.

## Rendering and UX

The ocean uses procedural geometry: fish bodies are ellipsoids with tail fins, food is glowing plankton, and fog/lighting creates depth without external 3D assets. The local fish is followed by a third-person camera that zooms out with mass. HUD shows mass, score, online player count, room and latency. Desktop controls use pointer-lock mouse look plus camera-relative WASD/arrows and Space/Shift; touch users get on-screen directional and vertical controls.

Shared fish/food geometries and shared reusable materials are kept outside churn-heavy create/remove paths. Per-fish color material is disposed when that fish mesh is removed.

## Reliability and security

Input payload size, protocol version and schema are validated. Names and room labels are sanitized and length-limited. The server clamps normalized input, delta time, movement speed and world bounds. A client cannot directly set mass, position, score or declare a collision. Spatial candidate lookup bounds collision work. Security headers are set on origin static responses, and the branded static frontend is delivered through Workers Static Assets.

## Testing

Pure game rules, protocol validation, reconnect state, spatial grid, room allocation and client camera/input behavior are covered by Node's built-in test runner. Build tests verify production Worker assembly and PWA/static assets. Public-alpha delivery tests assert snapshot coalescing, food deltas, collision-chain protection, GPU reuse, fixed Cloudflare account targets, Static Assets routing and pinned deployment commands. GitHub Actions runs tests, build and syntax validation on Node 22.

## Deployment

Authoritative Worker:

- name: `abyss-eater`
- account: `trinhtanphat6666`
- account ID: `6c5207813df3d5b83b9508125e0e9e12`
- origin: `abyss-eater.hikvision.workers.dev`
- Durable Object: `GAME_ROOM -> GameRoom`
- existing SQLite migration tag: `v1`

Branded delivery:

- Worker: `abyss-eater-gateway`
- account: `trinhtanphat2403`
- account ID: `50afb4fd3c4c7a1f3e1bdb7f22d4af7f`
- custom domain: `abyss-eater.qs3d.site`
- Workers Static Assets directory: `./public`
- Worker-first routes: `/ws`, `/health`

This cross-account gateway replaces the original design's deferred custom-domain assumption. It avoids an invalid cross-account Worker Custom Domain/CNAME arrangement without enabling Cloudflare for SaaS: the domain-owning account serves assets and proxies only realtime/health traffic to the authoritative workers.dev origin.

Wrangler is pinned to `4.129.1` in deployment scripts, and both Wrangler configs pin their account IDs so an authenticated environment cannot accidentally deploy to the wrong account.

## Cost constraint

Do not enable a paid Workers plan, Cloudflare for SaaS, or another paid/billable product as part of this implementation. These changes use components that can be configured without intentionally enabling a paid product. Account-level billing state is a separate operational fact and must be verified before claiming the entire production account is cost-free.
