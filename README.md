# Abyss Eater

**Abyss Eater: Ocean Survival** is a browser-first 3D multiplayer fish survival game. Start small, collect plankton, eat smaller fish, grow in mass, and avoid predators that are larger than you.

## Public alpha

- Procedural 3D ocean built with Three.js 0.185.1.
- Premium **Stylized** presentation by default with a live-switchable **Deep Sea** theme.
- Modular lobby, HUD, leaderboard, depth meter, danger indicator, procedural effects and touch joystick.
- Desktop controls: pointer-lock mouse look, pointer steering, camera-relative WASD / arrow keys, Space to swim up, Shift to swim down.
- Touch controls for phones and tablets.
- Local graphics presets `auto`, `high`, `medium`, `low`; the UI labels `medium` as **Balanced** without introducing a second persisted quality value.
- Reduced-effects mode plus gesture-gated local Web Audio settings; presentation settings never alter authoritative gameplay.
- Server-authoritative movement, world bounds, food collection, player eating, score and respawn.
- Protocol `v=2` with strict message validation and monotonic input sequences.
- Per-socket flood guard: 25 messages per 1000 ms window.
- Spatially bounded, deterministic player collision candidates.
- Local collision processing stops after the local fish is eaten and respawned, preventing same-input respawn chains.
- 12-second transient reconnect grace using a rotated opaque room-scoped resume key in `sessionStorage`.
- Disconnected reconnect slots are non-interactive and do not count toward the 20-player active room cap.
- User room labels are deterministically mapped into a fixed pool of 64 Durable Objects instead of creating unbounded room names.
- Room snapshots are coalesced to at most 20 Hz. Food is included only when dirty; player-only snapshots reuse the last food state on the client.
- Shared Three.js resources and explicit disposal reduce GPU churn during join/leave and plankton replacement.
- Installable PWA metadata, 192/512 icons and an offline application shell.
- WebSocket Hibernation API; no perpetual Durable Object game-loop timer.
- Dependency-free Node build and test pipeline.

## Architecture

```text
Browser / Three.js / PWA
       |
       | static files
       v
abyss-eater.qs3d.site
Workers Static Assets (trinhtanphat2403)
       |
       | /ws and /health only
       v
Gateway Worker (trinhtanphat2403)
       |
       | transparent proxy
       v
abyss-eater.hikvision.workers.dev
Game Worker (trinhtanphat6666)
       |
       | authoritative room
       v
Durable Object: GameRoom
  - WebSocket player attachments
  - fixed 64-room allocation pool
  - bounded reconnect slots
  - food state storage
  - movement authority
  - spatial collision/eating
  - <=20 Hz versioned snapshots
```

The browser client is split into small presentation, scene, environment, fish, input, network, state and UI modules under `public/game` and `public/ui`. Presentation modules can change themes, quality, effects, audio and HUD behavior without changing the server-authoritative simulation contract.

The client renders at display refresh rate and sends movement intent at 10 Hz. Clients never send authoritative position, mass, score, or collision results. Every gameplay WebSocket message carries protocol version `2`; the server rejects malformed, stale, incompatible, or flood traffic before applying simulation work.

Protocol v2 introduced optional food payloads in snapshots so unchanged food does not have to be resent every network update. A v1 browser fails closed on the version mismatch instead of silently misreading the delta format.

## Reconnect behavior

A successful `welcome` rotates and returns a `resumeKey` plus the current `inputSeq`. The browser stores the key as `abyss-eater-resume:<room-label>` in `sessionStorage`. Reconnecting to the same room label within 12 seconds can resume the same fish identity, position, mass, score and deaths without allowing the disconnected fish to interact while offline.

See `docs/runbooks/multiplayer-hardening.md` for the exact protocol, rate, reconnect, snapshot, release and rollback contract.

## PWA behavior

`public/manifest.webmanifest` supplies standalone-install metadata and maskable-capable install icons. `public/sw.js` caches the same-origin premium application shell and its local module graph, then falls back to the cached root page for offline navigation. Multiplayer itself still requires network access, and Three.js remains loaded from the pinned jsDelivr URL.

## Local validation

Node.js 22 or newer is required.

```bash
npm test
npm run build
node --check dist/worker.mjs
```

The production origin bundle is written to `dist/worker.mjs`. CI runs the Node 22 tests, build and syntax check on pull requests and `main`.

## Cloudflare

The authoritative game Worker is `abyss-eater` in account `trinhtanphat6666` (`6c5207813df3d5b83b9508125e0e9e12`). `wrangler.jsonc` pins that account and declares a SQLite-backed Durable Object binding named `GAME_ROOM` using the `GameRoom` class. Its origin is `https://abyss-eater.hikvision.workers.dev`.

The `qs3d.site` zone lives in `trinhtanphat2403` (`50afb4fd3c4c7a1f3e1bdb7f22d4af7f`). Production therefore uses `abyss-eater-gateway` on that account. `wrangler.gateway.jsonc` serves `./public` through Workers Static Assets on `https://abyss-eater.qs3d.site` and invokes the gateway Worker first only for `/ws` and `/health`; those routes proxy to the authoritative Worker in `trinhtanphat6666`. No gameplay state is stored in the gateway.

Reproducible deploy commands pin Wrangler `4.129.1`:

```bash
npm run deploy:game
npm run deploy:gateway
```

`/health` for the public-alpha delivery release reports application version `0.3.0`, protocol version `2`, room-pool size `64` and snapshot cap `20` Hz.

No paid Cloudflare product or paid-plan setting is enabled by this implementation. Existing account billing/plan state must be checked separately before claiming that the complete production account has zero cost.

## Still intentionally deferred

Accounts, persistent leaderboards, skins, shops, chat, parties, regional matchmaking, binary snapshots, client-side prediction, AI fish/biomes/bosses and external 3D models remain separate future work so the public-alpha networking and delivery baseline stays small, testable and rollback-friendly.
