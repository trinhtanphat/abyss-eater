# Abyss Eater V1 Carrier 3 Persistence & Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent guest identity, durable profile/progression, pearls, cosmetic ownership/shop, and durable leaderboard to the existing protocol-v2 public-alpha game without weakening server authority or enabling paid services.

**Architecture:** Keep hot room simulation inside `GameRoom` and use D1 only for cross-room durable state at bounded lifecycle events and explicit API mutations. The browser receives an opaque signed guest credential from the Worker, stores only that credential locally, and includes it on profile/shop APIs and as an optional WebSocket session query parameter; score, balance, inventory, rewards, and selected skin remain server-owned. Persistence failures fail closed for reward-changing operations and must never corrupt active room simulation.

**Tech Stack:** Cloudflare Workers, Durable Objects, D1 SQLite, Web Crypto HMAC-SHA-256, dependency-free Node 22 tests, existing vanilla browser/Three.js client.

**Spec:** `docs/superpowers/specs/2026-09-09-abyss-eater-v1-full-abc-design.md`

## Global Constraints

- Preserve application transport protocol version `2`; Carrier 3 does not change movement/snapshot protocol semantics.
- Preserve server-authoritative position, mass, score, collisions, respawn, and rewards.
- No secret literals in GitHub. Production signing key is read only from `env.SESSION_SECRET`.
- No paid Cloudflare product or paid external dependency may be enabled; free-tier exhaustion must fail/degrade instead of switching to billing.
- D1 is never written on movement ticks or snapshot broadcasts.
- The gateway remains stateless and owns no profile, inventory, leaderboard, or session state.
- All reward/shop mutations are idempotent or transactional and server-derived.
- Cosmetics must not alter speed, radius, mass, collision, or authoritative gameplay.
- Existing capability bootstrap, settings, audio, PWA/static-assets delivery, reconnect, delta snapshots, room pooling, and premium UIUX remain intact.

---

### Task 1: Pure progression, catalog, and signed guest-session primitives

**Files:**
- Create: `src/progression.mjs`
- Create: `src/session-token.mjs`
- Test: `tests/progression.test.mjs`
- Test: `tests/session-token.test.mjs`

**Interfaces:**
- Produces `SKIN_CATALOG`, `levelForXp(xp)`, `rewardForSession(summary)`, `skinById(id)`, `signSession(payload, secret, nowMs)`, and `verifySession(token, secret, nowMs)`.
- Session payload shape is `{ profileId: string, version: number, expiresAt: number }`.

- [ ] **Step 1: Write failing tests** for deterministic level thresholds, bounded rewards, catalog prices/unlock levels, HMAC round-trip, expiry, tamper rejection, and malformed-token rejection.
- [ ] **Step 2: Run `npm test`** and verify the new suites fail because the modules do not exist.
- [ ] **Step 3: Implement minimal pure modules.** Use Web Crypto only; token format is `base64url(payload-json).base64url(hmac)` and never contains balance/inventory/score.
- [ ] **Step 4: Run `npm test`** and verify all pure tests pass.
- [ ] **Step 5: Commit** `feat: add guest session and progression primitives`.

### Task 2: D1 schema and Worker binding

**Files:**
- Create: `migrations/0001_profiles.sql`
- Modify: `wrangler.jsonc`
- Test: `tests/persistence-schema.test.mjs`

**Interfaces:**
- Produces tables `profiles`, `profile_skins`, `leaderboard_entries`, and `reward_events`.
- Adds D1 binding name `DB`; the repository stores no database credential.

- [ ] **Step 1: Write failing schema/config test** requiring the four tables, uniqueness/index constraints, `session_version`, `selected_skin_id`, and a `DB` D1 binding.
- [ ] **Step 2: Run `npm test`** and verify failure before schema/config implementation.
- [ ] **Step 3: Add migration and binding.** `profiles` stores durable guest progression; `profile_skins(profile_id, skin_id)` is unique; `reward_events.id` is unique for idempotency; leaderboard rows are keyed by profile/season.
- [ ] **Step 4: Run `npm test`** and verify schema/config tests pass without requiring Cloudflare credentials.
- [ ] **Step 5: Commit** `feat: add D1 persistence schema`.

### Task 3: Persistence repository and profile/session APIs

**Files:**
- Create: `src/profile-store.mjs`
- Modify: `scripts/build.mjs`
- Modify: `src/worker.template.mjs`
- Test: `tests/profile-store.test.mjs`
- Test: `tests/profile-api.test.mjs`

**Interfaces:**
- Produces `createGuestProfile(db, displayName, nowMs, profileId)`, `readProfile(db, profileId)`, `readOwnedSkins(db, profileId)`, and Worker endpoints:
  - `POST /api/session` -> new/rotated guest credential + public profile
  - `GET /api/profile` -> authenticated public profile + owned skins/catalog
- Authentication header is `Authorization: Bearer <opaque-token>`; invalid credentials return bounded `401` JSON.

- [ ] **Step 1: Write failing repository/API tests** using a deterministic fake D1 adapter and static Worker bundle checks.
- [ ] **Step 2: Run `npm test`** and verify failures are limited to missing Carrier 3 repository/API behavior.
- [ ] **Step 3: Implement repository and APIs.** New guest IDs come from `crypto.randomUUID()`, names use the existing bounded normalization contract, and session version is validated server-side.
- [ ] **Step 4: Run `npm test && npm run build && node --check dist/worker.mjs`** and verify pass.
- [ ] **Step 5: Commit** `feat: add persistent guest profile APIs`.

### Task 4: Idempotent server-derived rewards and durable leaderboard

**Files:**
- Modify: `src/profile-store.mjs`
- Modify: `src/worker.template.mjs`
- Test: `tests/progression-persistence.test.mjs`

**Interfaces:**
- Produces `applySessionReward(db, profileId, eventId, summary, nowMs)` and `readLeaderboard(db, season, limit)`.
- Adds `GET /api/leaderboard?season=all-time&limit=N` with server-clamped `1..50` limit.
- A WebSocket may carry `session=<opaque-token>`; validated identity is attached to the player server-side. Reward persistence happens only at bounded authoritative lifecycle events (death/session settlement), never per input/snapshot.

- [ ] **Step 1: Write failing tests** proving duplicate reward event IDs do not double-credit, rewards cannot be client-priced, best score/mass are monotonic, and leaderboard ordering is deterministic.
- [ ] **Step 2: Run `npm test`** and verify RED.
- [ ] **Step 3: Implement bounded settlement path.** Derive reward from authoritative player state, insert `reward_events` first, update profile aggregates, and upsert leaderboard in one D1 batch; if D1 fails, do not acknowledge a durable reward.
- [ ] **Step 4: Run full test/build/syntax suite** and verify pass.
- [ ] **Step 5: Commit** `feat: persist authoritative progression rewards`.

### Task 5: Transactional cosmetic ownership and shop

**Files:**
- Modify: `src/profile-store.mjs`
- Modify: `src/worker.template.mjs`
- Test: `tests/shop.test.mjs`

**Interfaces:**
- Produces `purchaseSkin(db, profileId, skinId, nowMs)` and `selectSkin(db, profileId, skinId, nowMs)`.
- Adds authenticated endpoints:
  - `POST /api/shop/purchase` body `{ skinId }`
  - `POST /api/profile/skin` body `{ skinId }`
- Client never sends price or resulting balance.

- [ ] **Step 1: Write failing tests** for unknown skin, locked level, insufficient pearls, duplicate ownership, atomic debit+ownership, selection of unowned skin, and idempotent re-selection.
- [ ] **Step 2: Run `npm test`** and verify RED.
- [ ] **Step 3: Implement shop mutations** using catalog-owned price/unlock metadata and D1 batch statements; default skin is always available and never purchased.
- [ ] **Step 4: Run full test/build/syntax suite** and verify pass.
- [ ] **Step 5: Commit** `feat: add server-owned cosmetic shop`.

### Task 6: Persistent client identity, profile/shop/leaderboard presentation

**Files:**
- Modify: `public/bootstrap.js`
- Modify: `public/app.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/sw.js`
- Test: `tests/persistence-client.test.mjs`
- Test: `tests/premium-presentation-integration.test.mjs`

**Interfaces:**
- Stores only opaque credential under `abyss-eater-session-v1` in `localStorage`.
- Adds a small profile/progression surface showing level, XP, pearls, selected skin, owned skins, and leaderboard.
- WebSocket URL adds only the opaque `session` query parameter; authoritative movement payloads remain protocol v2 and unchanged.

- [ ] **Step 1: Write failing client/static tests** proving token-only storage, authenticated API helper, profile panel keyboard accessibility, shop request shape without price/balance, leaderboard view, `/sw.js` coverage, and preservation of premium UI markers.
- [ ] **Step 2: Run `npm test`** and verify RED.
- [ ] **Step 3: Implement client integration** with fail-soft profile reads; gameplay may start when persistence is unavailable but UI must state that progression is not being saved, and reward-changing shop operations fail closed.
- [ ] **Step 4: Run `npm test && npm run build && node --check dist/worker.mjs`** and verify all Carrier 1/2/premium regressions remain green.
- [ ] **Step 5: Commit** `feat: add persistent progression UI`.

### Task 7: Release hardening and deployment contract

**Files:**
- Modify: `README.md`
- Create: `docs/runbooks/persistence-progression.md`
- Modify: `tests/build.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Documents D1 migration/apply flow, `SESSION_SECRET` secret requirement, free-tier/cost boundary, rollback, and persistence-degraded behavior.
- Bumps application version from `0.3.0` to `0.4.0` while keeping protocol version `2`.

- [ ] **Step 1: Add static release tests** requiring version `0.4.0`, protocol `2`, no secret literal, D1 migration presence, and documented migration/deploy commands.
- [ ] **Step 2: Run `npm test`** and verify RED until release metadata/docs are updated.
- [ ] **Step 3: Update release metadata/docs** without adding deploy credentials or paid features.
- [ ] **Step 4: Run final `npm test && npm run build && node --check dist/worker.mjs`** and verify the exact candidate.
- [ ] **Step 5: Open PR, require exact-head CI green, merge with expected head SHA, then require post-merge `main` CI green before starting Carrier 4.**

## Self-review

Coverage: identity/session, D1 schema, profile APIs, bounded reward settlement, pearls, skins/ownership/shop, durable leaderboard, client presentation, failure behavior, secret handling, PWA preservation, release documentation and cost boundary are each mapped to a task. No binary networking, email/OAuth, real-money payments, social features, AI/world features, or per-tick D1 writes are included because those belong to later carriers or are explicit non-goals. Interface names are consistent across tasks and the plan contains no deferred placeholders.