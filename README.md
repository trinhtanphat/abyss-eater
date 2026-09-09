# Abyss Eater

**Abyss Eater: Ocean Survival** is a browser-first 3D multiplayer fish-survival game. Start small, collect marine food, hunt smaller fish, grow in mass, and avoid predators that can eat you.

## Public alpha

- Procedural Three.js 0.185.1 ocean with six presentation biomes: **Sunken Reef**, **Ancient Abyss**, **Twilight Garden**, **Blue Trench**, **Volcanic Rift**, and **Leviathan Depths**. Legacy `stylized` and `deep-sea` settings remain compatible.
- Server-owned living ecosystem with 24 wildlife fish per room, including prey below starter mass and predators above it.
- Server-authoritative movement, world bounds, food collection, PvP/wildlife eating, score, growth, death and respawn.
- Six mass-driven fish evolution silhouettes plus 12 deterministic presentation skin families. A server-verified selected `skinId` always takes precedence over visual fallbacks.
- Persistent guest progression with opaque signed session credentials, XP, levels, pearls, owned skins, selected skins, best-run stats and durable all-time / UTC-quarter leaderboards.
- D1 persistence stores server-side session mappings, profiles, cosmetic ownership and idempotent reward checkpoints; movement, snapshots and ordinary input never write D1.
- Canonical shop rules stay server-side. The client can request a `skinId` but never submits prices, balances or gameplay modifiers.
- Compact desktop/mobile HUD with score, rank, edible-prey count, threat count, player count, ping, growth, depth and responsive leaderboards.
- Branded same-origin SVG lobby/HUD assets, bounded eat/growth VFX and localized bioluminescence.
- Optional Vietnamese voice announcements through lazy-loaded Piper TTS with native `vi-VN` speech-synthesis fallback.
- Desktop controls: pointer-lock mouse look, pointer steering, camera-relative WASD / arrow keys, Space to swim up, C to descend, and Shift to boost 1.55x; holding Shift beyond 3 seconds drains 5 score per second until released.
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
       | /ws, /health and /api/* only
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
       +--> PROFILE_DB (production-injected D1 binding)
              - opaque session -> profile mapping
              - XP / level / pearls / best run
              - owned + selected skins
              - idempotent reward checkpoints
              - all-time + UTC-quarter leaderboards
```

The browser client is split into small presentation, scene, environment, fish, input, network, progression, state and UI modules under `public/`. Presentation code can change biome, quality, effects, audio, TTS, cosmetics and HUD behavior without changing the authoritative simulation contract.

The client renders at display refresh rate and sends movement intent at 10 Hz. Clients never send authoritative position, mass, score, collision results, shop prices or balances. Every gameplay WebSocket message carries protocol version `2`; the server rejects malformed, stale, incompatible or flood traffic before applying simulation work.

Protocol v2 supports delta snapshots so unchanged food/wildlife data does not need to be resent every network update. Incompatible clients fail closed on the version mismatch instead of silently misreading state.

## Persistent guest progression

The first profile bootstrap creates a random server-side profile and a separate opaque session id. The signed browser token contains only that opaque session id, token version and expiry. D1 maps the session id to the profile; clearing the local token intentionally starts a new guest identity on the next bootstrap.

Profile APIs fail closed with `persistence_unavailable` when `PROFILE_DB` or `SESSION_SIGNING_KEY` is unavailable. Anonymous realtime play remains available. Rewards are derived from authoritative score/mass/eat deltas at bounded death/disconnect checkpoints and use `<gameSessionId>:<checkpointSeq>` idempotency keys. Each applied reward updates both the all-time leaderboard and the current UTC-quarter season.

The profile panel displays level, XP progress, pearls, best run, owned skins and durable rankings. Skin prices and unlock rules are canonical server data; selected skins change rendering materials only.

## Reconnect behavior

A successful `welcome` rotates and returns a `resumeKey` plus the current `inputSeq`. The browser stores the key as `abyss-eater-resume:<room-label>` in `sessionStorage`. Reconnecting to the same room label within 12 seconds can resume the same fish identity, position, mass, score and deaths without allowing the disconnected fish to interact while offline.

See `docs/runbooks/multiplayer-hardening.md` for the exact protocol, rate, reconnect, snapshot, release and rollback contract.

## PWA and presentation behavior

`public/manifest.webmanifest` supplies standalone-install metadata and maskable-capable install icons. `public/sw.js` caches the same-origin application shell, progression modules, fish evolution/skin modules and local SVG assets, then falls back to the cached root page for offline navigation. Multiplayer itself still requires network access; Three.js and the optional Piper runtime remain pinned external dependencies.

The six ocean biomes are presentation-only. `stylized` and `deep-sea` remain valid saved values, while the expanded catalog adds four newer biome ids. Fish cosmetics follow the same authority rule: server-verified purchased/selected cosmetics take priority; deterministic presentation palettes are fallback visuals and never affect gameplay stats.

Vietnamese TTS is opt-in and lazy-loaded. When enabled, the client uses the pinned Piper web runtime/voice path and falls back to native `vi-VN` speech synthesis when Piper is unavailable.

## Local validation

Node.js 22 or newer is required.

```bash
npm test
npm run build
node --check dist/worker.mjs
```

The production origin bundle is written to `dist/worker.mjs`. GitHub Actions is intentionally **CI-only**: pull requests and `main` run tests, build and syntax checks, while bounded visual-review runs produce screenshot evidence for presentation changes.

After successful CI on the exact current `main`, the **Production smoke** workflow runs a **read-only** verification against both production endpoints. It checks static convergence, health metadata, four-player protocol-v2 realtime input/boost behavior and reconnect/resume without deploying or mutating Cloudflare.

## Delivery

Production delivery is handled by the connected Cloudflare deployment integration that watches `main`; the repository does not perform production mutation from GitHub Actions.

The authoritative game Worker is `abyss-eater` in account `trinhtanphat6666` (`6c5207813df3d5b83b9508125e0e9e12`). `wrangler.jsonc` pins that account and declares `GAME_ROOM -> GameRoom`. Production persistence is intentionally absent from the source config: `scripts/render-production-wrangler.mjs` injects `PROFILE_DB` only from an already-existing `ABYSS_EATER_D1_DATABASE_ID`. Its origin is `https://abyss-eater.hikvision.workers.dev`.

The `qs3d.site` zone lives in `trinhtanphat2403` (`50afb4fd3c4c7a1f3e1bdb7f22d4af7f`). Production uses `abyss-eater-gateway` on that account. `wrangler.gateway.jsonc` serves `./public` through Workers Static Assets on `https://abyss-eater.qs3d.site` and invokes the gateway Worker first only for `/ws`, `/health` and `/api/*`; those routes proxy to the authoritative Worker. No gameplay state is stored in the gateway.

Pinned Wrangler commands remain as explicit reproducible/manual tooling. They are not invoked by GitHub Actions, never create a D1 database, and the production renderer refuses a missing or malformed existing D1 id:

```bash
ABYSS_EATER_D1_DATABASE_ID=<existing-d1-uuid> npm run deploy:game
npm run deploy:gateway
```

`SESSION_SIGNING_KEY` and the production D1 database are provisioning prerequisites outside the CI workflow. `/health` reports application version `0.3.0`, protocol version `2`, room-pool size `64`, wildlife-per-room `24`, snapshot cap `20` Hz, and the authoritative Shift-boost tuning (1.55x, 3-second grace, 5 score/second drain).

No paid Cloudflare product or paid-plan setting is enabled by this implementation.

## Still intentionally deferred

Email/OAuth account linking, real-money payments, chat, parties, regional matchmaking, binary snapshots, client-side prediction, dedicated boss encounters, full biome gameplay progression and external authored 3D model packs remain future work. The public alpha already includes persistent guest profiles, opaque sessions, pearls/XP/levels, canonical cosmetic shop/selection, bounded wildlife, six ocean presentation biomes and durable all-time / seasonal leaderboards.
