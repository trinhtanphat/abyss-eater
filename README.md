# Abyss Eater

**Abyss Eater: Ocean Survival** is a browser-first 3D multiplayer fish-survival game. Start small, collect marine food, hunt smaller fish, grow in mass, and avoid predators that can eat you.

## Public alpha

- Procedural Three.js 0.185.1 ocean with six presentation biomes: **Sunken Reef**, **Ancient Abyss**, **Twilight Garden**, **Blue Trench**, **Volcanic Rift**, and **Leviathan Depths**. Legacy `stylized` and `deep-sea` settings remain compatible.
- Server-owned living ecosystem with 24 wildlife fish per room, including prey below starter mass and predators above it.
- Server-authoritative movement, world bounds, food collection, PvP/wildlife eating, score, growth, death and respawn.
- Six mass-driven fish evolution silhouettes plus 12 deterministic presentation skin families. A server-verified selected `skinId` always takes precedence over visual fallbacks.
- Persistent guest progression path with signed sessions, XP, levels, pearls, owned skins, selected skin, canonical shop actions and persistent leaderboard APIs.
- Compact desktop/mobile HUD with score, rank, edible-prey count, threat count, player count, ping, growth, depth and a responsive leaderboard.
- Branded same-origin SVG asset pack for the lobby and HUD, plus bounded eat/growth VFX and localized bioluminescence.
- Optional Vietnamese voice announcements through lazy-loaded Piper TTS with native `vi-VN` speech-synthesis fallback.
- Desktop controls: pointer-lock mouse look, pointer steering, camera-relative WASD / arrow keys, Space to swim up, Shift to swim down.
- Touch controls for phones and tablets.
- Local graphics presets `auto`, `high`, `medium`, `low`; the UI labels `medium` as **Balanced** without introducing a second persisted quality value.
- Reduced-effects mode plus gesture-gated local Web Audio/TTS settings; presentation settings never alter authoritative gameplay.
- Protocol `v=2` with strict message validation, monotonic input sequences and a per-socket flood guard of 25 messages per 1000 ms.
- Spatially bounded deterministic collision candidates; local collision processing stops after respawn to prevent same-input respawn chains.
- 12-second reconnect grace using a rotated opaque room-scoped resume key in `sessionStorage`.
- User room labels map deterministically into a fixed pool of 64 Durable Objects; disconnected slots do not count toward the 20-player active cap.
- Room snapshots are coalesced to at most 20 Hz. Food and wildlife payloads are sent only when dirty and retained client-side across delta snapshots.
- Shared Three.js resources and explicit disposal reduce GPU churn during joins, leaves and food replacement.
- Installable PWA metadata, 192/512 icons and an offline application shell.
- WebSocket Hibernation API; no perpetual Durable Object game-loop timer.
- Dependency-free Node build/test pipeline plus bounded headless visual-review screenshot coverage.

## Architecture

```text
Browser / Three.js / PWA
       |
       | static files + HTTPS API
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
       +--> Durable Object: GameRoom
       |      - WebSocket player attachments
       |      - fixed 64-room allocation pool
       |      - bounded reconnect slots
       |      - food + 24 wildlife actors
       |      - movement/collision/eating authority
       |      - <=20 Hz versioned snapshots
       |
       +--> D1 persistence contract
              - guest profiles + signed sessions
              - XP / level / pearls
              - owned + selected skins
              - idempotent reward events
              - persistent leaderboard
```

The browser client is split into small presentation, scene, environment, fish, input, network, progression, state and UI modules under `public/`. Presentation code can change biome, quality, effects, audio, TTS, cosmetics and HUD behavior without changing the authoritative simulation contract.

The client renders at display refresh rate and sends movement intent at 10 Hz. Clients never send authoritative position, mass, score, collision results, shop prices or balances. Every gameplay WebSocket message carries protocol version `2`; the server rejects malformed, stale, incompatible or flood traffic before applying simulation work.

Persistent identity is also server-owned: a signed guest session is verified before its profile id and selected cosmetic can enter a room snapshot. Shop APIs accept only a canonical `skinId`; pricing, unlock rules, pearl balances and ownership checks stay on the server. Persistence APIs fail closed when required runtime bindings are unavailable.

## Reconnect behavior

A successful `welcome` rotates and returns a `resumeKey` plus the current `inputSeq`. The browser stores the key as `abyss-eater-resume:<room-label>` in `sessionStorage`. Reconnecting to the same room label within 12 seconds can resume the same fish identity, position, mass, score and deaths without allowing the disconnected fish to interact while offline.

See `docs/runbooks/multiplayer-hardening.md` for the exact protocol, rate, reconnect, snapshot, release and rollback contract.

## PWA and presentation behavior

`public/manifest.webmanifest` supplies standalone-install metadata and maskable-capable install icons. `public/sw.js` caches the same-origin application shell, progression modules, fish evolution/skin modules and local SVG assets, then falls back to the cached root page for offline navigation. Multiplayer itself still requires network access.

The six ocean biomes are presentation-only. `stylized` and `deep-sea` remain valid saved values, while the expanded catalog adds the four newer biome ids. Fish cosmetics follow the same rule: server-verified purchased/selected cosmetics take priority; deterministic presentation palettes are only fallback visuals and never affect gameplay stats.

Vietnamese TTS is opt-in and lazy-loaded. When enabled, the client uses the pinned Piper web runtime/voice path and falls back to native `vi-VN` speech synthesis when Piper is unavailable.

## Local validation

Node.js 22 or newer is required.

```bash
npm test
npm run build
node --check dist/worker.mjs
```

The production origin bundle is written to `dist/worker.mjs`. GitHub Actions is intentionally **CI-only**: pull requests and `main` run tests, build and syntax checks, while bounded visual-review runs produce screenshot evidence for presentation changes.

## Delivery

Production delivery is handled by the connected Cloudflare deployment integration that watches `main`; the repository does not run a production-mutation workflow from GitHub Actions.

The authoritative game Worker is `abyss-eater` in account `trinhtanphat6666` (`6c5207813df3d5b83b9508125e0e9e12`). `wrangler.jsonc` pins that account, declares the SQLite-backed `GAME_ROOM` Durable Object binding and keeps the draft D1 binding contract used by persistent progression. Its origin is `https://abyss-eater.hikvision.workers.dev`.

The `qs3d.site` zone lives in `trinhtanphat2403` (`50afb4fd3c4c7a1f3e1bdb7f22d4af7f`). Production uses `abyss-eater-gateway` on that account. `wrangler.gateway.jsonc` serves `./public` through Workers Static Assets on `https://abyss-eater.qs3d.site` and invokes the gateway Worker first only for `/ws` and `/health`; those routes proxy to the authoritative Worker. No gameplay state is stored in the gateway.

Pinned Wrangler commands remain available as reproducible manual fallback tooling, but they are not called by GitHub Actions:

```bash
npm run deploy:game
npm run deploy:gateway
```

`/health` reports application version `0.3.0`, protocol version `2`, room-pool size `64`, wildlife-per-room `24` and snapshot cap `20` Hz.

No paid Cloudflare product or paid-plan setting is enabled by this implementation.

## Still intentionally deferred

Full registered user accounts/login, chat, parties, regional matchmaking, binary snapshots, client-side prediction, dedicated boss encounters and external authored 3D model packs remain future work. The current public alpha already includes persistent guest progression, persistent leaderboard APIs, canonical skin shop/selection, server-owned wildlife and six ocean presentation biomes.
