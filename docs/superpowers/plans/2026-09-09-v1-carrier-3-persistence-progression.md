# Abyss Eater V1 Carrier 3 Persistence and Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent guest identity, signed sessions, XP/levels, pearls, cosmetic ownership/selection, idempotent bounded rewards, and durable seasonal/all-time leaderboards without putting D1 writes on the hot movement path.

**Architecture:** Keep `GameRoom` authoritative for realtime play. Add small pure domain modules for session credentials and progression, a D1-backed profile repository, same-origin `/api/*` routes on the authoritative Worker, and a client profile module. Realtime WebSockets bind a validated profile once at join; progression writes occur only at bounded checkpoints such as death/disconnect, never per input/snapshot.

**Tech Stack:** Cloudflare Workers, Durable Objects, D1 SQLite, Web Crypto HMAC-SHA-256, Node.js 22 tests/build, vanilla browser ES modules.

**Spec:** `docs/superpowers/specs/2026-09-09-abyss-eater-v1-full-abc-design.md`

## Global Constraints

- No real-money payments, subscriptions, trading, or paid-only Cloudflare products.
- If persistence configuration is missing, profile APIs fail closed while the existing realtime game remains available.
- No secrets or production D1 ids are hardcoded in source.
- D1 must never be written for every input, frame, or snapshot.
- Cosmetic skins never alter mass, speed, collision radius, hitbox, or any authoritative gameplay rule.
- Balance/inventory mutations are server-owned, transactional, and idempotent.
- Protocol v2/reconnect behavior and the existing premium Stylized/Deep Sea client must remain compatible.

---

### Task 1: Pure progression and cosmetic catalog

**Files:**
- Create: `src/progression.mjs`
- Create: `tests/progression.test.mjs`

**Interfaces:**
- Produces: `XP_PER_LEVEL`, `MAX_LEVEL`, `SKIN_CATALOG`, `levelForXp(xp)`, `rewardForCheckpoint(checkpoint)`, `skinById(id)`.
- `rewardForCheckpoint({ scoreDelta, peakMass, playerEats, survivedMs })` returns bounded `{ xp, pearls }` integers.

- [ ] **Step 1: Write failing tests** for deterministic level thresholds, non-finite rejection, reward caps, and catalog entries that contain visual-only parameters.
- [ ] **Step 2: Run** `node --test tests/progression.test.mjs` and verify RED because `src/progression.mjs` does not exist.
- [ ] **Step 3: Implement** a level curve of `1 + floor(xp / 1000)` capped at 50; reward XP from bounded score/survival/player-eat inputs and pearls from XP milestones; define three free/earnable visual skins with no gameplay values.
- [ ] **Step 4: Run** `node --test tests/progression.test.mjs` and verify GREEN.
- [ ] **Step 5: Commit** `feat(progression): add bounded progression domain`.

### Task 2: Signed opaque guest-session credentials

**Files:**
- Create: `src/guest-session.mjs`
- Create: `tests/guest-session.test.mjs`

**Interfaces:**
- Produces: `newSessionId()`, `signSessionCredential({ sessionId, expiresAt }, secret)`, `verifySessionCredential(token, secret, now)`.
- Credential format carries only random session id, expiry, version, and HMAC signature; profile id/balance/inventory never appear in the token.

- [ ] **Step 1: Write failing tests** proving valid round-trip, expiry rejection, tamper rejection, wrong-secret rejection, bounded token length, and no embedded profile/balance fields.
- [ ] **Step 2: Run** `node --test tests/guest-session.test.mjs` and verify RED.
- [ ] **Step 3: Implement** Web Crypto HMAC-SHA-256 with base64url encoding, constant-shape verification, 32-byte random session ids, and version `1`.
- [ ] **Step 4: Run** the guest-session tests and verify GREEN.
- [ ] **Step 5: Commit** `feat(identity): add signed guest session credentials`.

### Task 3: D1 schema, atomic rewards, and atomic skin spending

**Files:**
- Create: `migrations/0001_profiles_progression.sql`
- Create: `src/profile-store.mjs`
- Create: `tests/profile-store.test.mjs`

**Interfaces:**
- Tables: `profiles`, `sessions`, `skins`, `profile_skins`, `reward_events`, `leaderboard_entries`.
- Produces repository functions: `createGuestProfile(db, input)`, `profileForSession(db, sessionId, now)`, `readProfile(db, profileId)`, `applyRewardEvent(db, event)`, `buySkin(db, profileId, skinId, now)`, `selectSkin(db, profileId, skinId, now)`, `readLeaderboard(db, scope, limit)`.

- [ ] **Step 1: Write failing repository/SQL contract tests** asserting primary/foreign keys, bounded indexes, seeded skins, unique reward idempotency key, and no dynamic SQL interpolation.
- [ ] **Step 2: Run** `node --test tests/profile-store.test.mjs` and verify RED.
- [ ] **Step 3: Add migration** with an `AFTER INSERT` trigger on `reward_events` that updates profile XP/level/pearls/bests and leaderboards in the same SQLite transaction; add a purchase trigger so one `profile_skins` insert validates level/pearls and deducts pearls atomically.
- [ ] **Step 4: Implement repository functions** using prepared statements and `db.batch()` only for multi-row guest creation/session issuance; duplicate reward ids return the current profile without a second credit.
- [ ] **Step 5: Run** repository tests and the full `npm test` suite.
- [ ] **Step 6: Commit** `feat(persistence): add D1 profile and economy store`.

### Task 4: Same-origin profile APIs and fail-closed persistence wiring

**Files:**
- Create: `src/profile-api.mjs`
- Modify: `src/worker.template.mjs`
- Modify: `scripts/build.mjs`
- Create: `tests/profile-api.test.mjs`
- Modify: `tests/build.test.mjs`

**Interfaces:**
- Routes: `POST /api/session/guest`, `GET /api/profile`, `GET /api/skins`, `POST /api/skins/buy`, `POST /api/skins/select`, `GET /api/leaderboard?scope=all-time|seasonal`.
- Auth: `Authorization: Bearer <signed-session-token>`.
- Missing `env.PROFILE_DB` or `env.SESSION_SIGNING_KEY` returns JSON `503 { error: "persistence_unavailable" }` for persistence APIs only.

- [ ] **Step 1: Write failing API/build tests** for method guards, JSON content type, auth failure, bounded body size, unknown skin ids, leaderboard limit clamp, and build-marker inclusion.
- [ ] **Step 2: Run** targeted tests and verify RED.
- [ ] **Step 3: Implement** profile API dispatcher with uniform JSON errors and no raw stack traces; inject `guest-session`, `progression`, `profile-store`, and `profile-api` source into the production Worker through required build markers.
- [ ] **Step 4: Run** targeted tests and full `npm run check`.
- [ ] **Step 5: Commit** `feat(api): add guest profile and progression endpoints`.

### Task 5: Bind validated profile identity to realtime sessions and bounded rewards

**Files:**
- Modify: `src/worker.template.mjs`
- Modify: `public/game/network.js`
- Modify: `public/game/state.js`
- Create: `tests/profile-realtime.test.mjs`

**Interfaces:**
- Browser sends the signed token only on WebSocket connect as `session=<token>`.
- Outer Worker validates the credential/session row and forwards only internal `profileId`, `skinId`, and a random `gameSessionId` to `GameRoom`.
- `publicPlayer()` adds `skinId`; it never exposes session ids/tokens/profile ids.
- Reward checkpoint id format: `<gameSessionId>:<checkpointSeq>`.

- [ ] **Step 1: Write failing tests** proving an invalid token cannot choose a profile id, public snapshots hide profile/session ids, reconnect stays protocol-v2 compatible, and source contains no D1 write in the input movement/snapshot loop.
- [ ] **Step 2: Run** `node --test tests/profile-realtime.test.mjs` and verify RED.
- [ ] **Step 3: Implement** join-time validation and player attachment metadata. On player death or disconnect, compute `rewardForCheckpoint()` from deltas since the previous checkpoint and schedule one idempotent `applyRewardEvent()`; reset checkpoint counters after scheduling.
- [ ] **Step 4: Run** realtime tests plus existing protocol/worker/reconnect tests.
- [ ] **Step 5: Commit** `feat(realtime): bind profiles and bounded progression rewards`.

### Task 6: Profile, skins, and leaderboard client flow

**Files:**
- Create: `public/client-profile.mjs`
- Create: `public/ui/profile.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`
- Modify: `public/game/fish.js`
- Modify: `public/sw.js`
- Create: `tests/client-profile.test.mjs`
- Modify: `tests/build.test.mjs`

**Interfaces:**
- `createProfileClient()` owns localStorage token bootstrap, profile refresh, buy/select calls, and leaderboard fetches.
- UI shows level, XP progress, pearls, best score/mass, owned skins, selected skin, and top leaderboard rows.
- Fish rendering maps server-provided `skinId` to visual palette/material parameters only.

- [ ] **Step 1: Write failing client/build tests** for first-run guest creation, token reuse, invalid-token replacement, profile rendering markers, skin purchase/select requests, service-worker precache, and visual-only skin application.
- [ ] **Step 2: Run** targeted tests and verify RED.
- [ ] **Step 3: Implement** the client module and responsive profile/shop/leaderboard panels without disturbing the current lobby/HUD/settings layout.
- [ ] **Step 4: Run** client tests, `npm test`, `npm run build`, and `node --check dist/worker.mjs`.
- [ ] **Step 5: Commit** `feat(client): add persistent progression and cosmetics UI`.

### Task 7: Production binding and migration gate without hardcoded infrastructure ids

**Files:**
- Create: `scripts/render-production-wrangler.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/deploy-production.yml`
- Create: `tests/persistence-deploy.test.mjs`

**Interfaces:**
- Required deployment inputs: `ABYSS_EATER_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN_6666`, and an already-provisioned Worker secret `SESSION_SIGNING_KEY`.
- Generated `dist/wrangler.production.jsonc` adds `PROFILE_DB` while preserving existing `GAME_ROOM` bindings/migrations.

- [ ] **Step 1: Write failing tests** proving the render script rejects missing/malformed D1 ids, preserves account/DO settings, and deploy workflow runs D1 migrations before Worker deploy.
- [ ] **Step 2: Run** `node --test tests/persistence-deploy.test.mjs` and verify RED.
- [ ] **Step 3: Implement** config rendering and change `deploy:game` to use the generated production config only when persistence activation inputs are present; workflow must fail before Wrangler on missing inputs.
- [ ] **Step 4: Add** `wrangler d1 migrations apply abyss-eater-profile --remote --config dist/wrangler.production.jsonc` before the Worker deploy step.
- [ ] **Step 5: Run** `npm run check` and deployment source-contract tests.
- [ ] **Step 6: Commit** `ci(persistence): gate D1 migration and production binding`.

### Task 8: Final verification and integration

**Files:**
- Modify: `README.md`
- Modify: `docs/runbooks/multiplayer-hardening.md`

- [ ] **Step 1: Document** guest identity reset behavior, persistence-unavailable fallback, reward checkpoint boundaries, D1 migration command, required secrets, and rollback rule.
- [ ] **Step 2: Run** `npm run check`; expected result is all tests PASS, Worker build PASS, syntax check PASS.
- [ ] **Step 3: Open PR** from `feat/carrier-3-persistence-progression` to `main` and require exact-head CI GREEN.
- [ ] **Step 4: Review** changed files for accidental real-money/payment paths, client-authoritative balance logic, hot-loop D1 writes, hardcoded Cloudflare ids/secrets, or protocol-v2 regressions.
- [ ] **Step 5: Merge only after GREEN**; then verify post-merge CI on the merge SHA.
- [ ] **Step 6: Production activation remains blocked** until the existing free/no-charge Cloudflare account has a D1 database id and session signing secret configured; do not create or enable billable resources implicitly.
