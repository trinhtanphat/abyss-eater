# Abyss Eater MVP Implementation Plan

**Status:** Completed historical MVP plan. The checklist is retained for traceability; current public-alpha delivery has evolved beyond this baseline.

Current delivery is owned by the connected Cloudflare deployment integration watching `main`; GitHub Actions stays CI/read-only verification only. The branded endpoint is `https://abyss-eater.qs3d.site` through the separate gateway account.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build and deploy a playable server-authoritative 3D multiplayer Abyss Eater MVP.

**Architecture:** A browser Three.js client connects by WebSocket to a Cloudflare Worker that routes each room to a SQLite-backed Durable Object. Pure game rules are dependency-free modules tested with Node's built-in test runner; a dependency-free build script embeds public assets and shared logic into one deployable module Worker.

**Tech Stack:** Browser ES modules, Three.js 0.185.1 CDN, Node.js 22, Cloudflare Workers, Durable Objects WebSocket Hibernation API, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-09-abyss-eater-mvp-design.md`

## Global Constraints

- Production Worker name is `abyss-eater` in Cloudflare account `trinhtanphat6666`.
- Do not enable paid Cloudflare products.
- During the original MVP phase, keep `qs3d.site` unchanged because its zone is in a different Cloudflare account; the later public alpha added only the dedicated `abyss-eater.qs3d.site` gateway on that separate account.
- Server authority owns movement bounds, eating, mass, scores and respawns.
- Do not run perpetual game-loop timers in Durable Objects.
- GitHub CI must run with Node 22 and no repository secrets for validation.

---

### Task 1: Authoritative game rules

**Files:**
- Create: `src/game-logic.mjs`
- Create: `tests/game-logic.test.mjs`

**Interfaces:**
- Produces: `clampDirection(dir)`, `radiusForMass(mass)`, `speedForMass(mass)`, `advancePlayer(player, dir, dt, bounds)`, `canEat(predator, prey)`, `collectFood(player, food)`, `respawnPlayer(player, spawn)`.

- [x] Write failing tests covering input normalization, bounded movement, size/speed scaling, valid/invalid eating thresholds, food growth, and respawn reset.
- [x] Run `node --test tests/game-logic.test.mjs` and confirm RED because the module does not exist.
- [x] Implement the smallest pure game-rule module that passes those tests.
- [x] Run `node --test tests/game-logic.test.mjs` and confirm GREEN.

### Task 2: Worker and room protocol

**Files:**
- Create: `src/worker.template.mjs`
- Create: `tests/build.test.mjs`
- Create: `scripts/build.mjs`
- Create: `wrangler.jsonc`

**Interfaces:**
- Consumes game-rule functions from Task 1 at build time.
- Produces routes `/`, `/app.js`, `/styles.css`, `/manifest.webmanifest`, `/health`, `/ws` and exported `GameRoom` Durable Object.

- [x] Write a failing build test requiring the production bundle to contain `GameRoom`, `acceptWebSocket`, `/health`, `/ws`, and all four public assets.
- [x] Run the build test and confirm RED because the builder/template is absent.
- [x] Implement the Worker template and dependency-free build assembler.
- [x] Build `dist/worker.mjs` and run the build test to GREEN.

### Task 3: 3D client and game UX

**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`
- Create: `public/manifest.webmanifest`

**Interfaces:**
- Connects to `/ws?room=<room>&name=<name>`.
- Consumes `welcome`, `snapshot`, `pong`, and `error` protocol messages.

- [x] Add a failing build assertion that production output embeds the pinned Three.js URL, HUD markers, touch controls, and WebSocket endpoint.
- [x] Run tests and confirm RED.
- [x] Implement procedural ocean/fish/plankton rendering, interpolation, camera follow/zoom, keyboard and touch input, HUD, connection/reconnect behavior.
- [x] Rebuild and run the full tests to GREEN.

### Task 4: Repository quality and deployment metadata

**Files:**
- Create: `package.json`
- Create: `.github/workflows/ci.yml`
- Create: `.gitignore`
- Create: `README.md`

**Interfaces:**
- `npm test` runs Node tests.
- `npm run build` creates the deployable Worker.

- [x] Add package scripts and CI workflow using Node 22.
- [x] Document architecture, local validation, controls, Cloudflare target account and cross-account domain limitation.
- [x] Run `npm test` and `npm run build` from a clean checkout-equivalent directory.
- [x] Commit local implementation with descriptive commits.

### Task 5: Cloudflare production deployment

**Files:**
- Deploy artifact: `dist/worker.mjs`

**Interfaces:**
- Cloudflare Worker script: `abyss-eater`.
- Durable Object binding: `GAME_ROOM` -> `GameRoom`, SQLite storage.

- [x] Upload the module Worker with a Durable Object binding and new SQLite class migration.
- [x] Confirm `workers.dev` is enabled for the Worker.
- [x] Fetch `/health` and `/` from the deployed URL and verify success.
- [x] Open a WebSocket connection probe if available; otherwise verify deployment metadata and HTTP routing.
- [x] Leave `qs3d.site` DNS untouched for the original MVP phase because the zone belongs to another account. A later delivery phase added only `abyss-eater.qs3d.site` through the separate gateway account.
