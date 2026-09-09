# Abyss Eater V1 Carrier 1 Multiplayer Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing 20-player authoritative room with versioned protocol parsing, input/rate limits, deterministic conflict resolution, spatial indexing, resumable transient reconnects, and bounded room lifecycle behavior without adding paid services.

**Architecture:** Keep `GameRoom` as the sole gameplay authority. Move reusable protocol and spatial logic into small dependency-free source modules that the existing build assembler embeds into the production Worker. Reconnect uses an opaque high-entropy per-room resume key in Carrier 1; Carrier 3 later binds the same resume interface to persistent guest identity without changing room authority.

**Tech Stack:** Browser ES modules, Node.js 22 built-in test runner, Cloudflare Workers, SQLite-backed Durable Objects, WebSocket Hibernation API, dependency-free build assembler.

**Spec:** `docs/superpowers/specs/2026-09-09-abyss-eater-v1-full-abc-design.md`

## Global Constraints

- Production Worker remains `abyss-eater` on Cloudflare account `trinhtanphat6666`.
- Gateway remains stateless `abyss-eater-gateway` on `trinhtanphat2403`.
- Do not enable paid Cloudflare products.
- Server authority owns position, movement speed, world bounds, collision/eating, mass, score, respawn and reconnect presence.
- No perpetual `setInterval()`/`setTimeout()` simulation loop in a Durable Object.
- Public-room target remains 20 players until load evidence supports a higher cap.
- GitHub pull-request validation remains secret-free on Node.js 22.
- Stable JSON remains the compatibility baseline; binary snapshots are not enabled in Carrier 1.

---

### Task 1: Versioned protocol parser and bounded rate window

**Files:**
- Create: `src/protocol.mjs`
- Create: `tests/protocol.test.mjs`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Produces: `PROTOCOL_VERSION = 1`.
- Produces: `parseClientMessage(rawMessage)` returning `{ ok: true, message }` or `{ ok: false, code }`.
- Produces: `acceptSequence(lastSeq, nextSeq)` returning boolean.
- Produces: `consumeRateWindow(state, now, limit, windowMs)` returning `{ allowed, state }` where state is `{ startedAt, count }`.
- Client input schema is `{ type: 'input', v: 1, seq: safeInteger, dir: {x,y,z} }`.
- Ping schema is `{ type: 'ping', v: 1, t: finiteNumber }`.

- [ ] **Step 1: Add protocol RED tests**

Add tests that require: string messages only; maximum 1024 UTF-16 code units; valid JSON object; exact `v: 1`; `input.seq` must be a non-negative safe integer; `dir.x/y/z` must each be finite numbers; `ping.t` must be finite; unknown type returns `bad_type`; oversized input returns `bad_message`; stale/non-increasing sequence returns false; and a 25-message/1000ms rate window rejects the 26th message while resetting after the window.

Use assertions like:

```js
assert.deepEqual(parseClientMessage('{"type":"input","v":1,"seq":2,"dir":{"x":1,"y":0,"z":0}}'), {
  ok: true,
  message: { type: 'input', v: 1, seq: 2, dir: { x: 1, y: 0, z: 0 } },
});
assert.deepEqual(parseClientMessage('{"type":"input","v":2,"seq":2,"dir":{"x":1,"y":0,"z":0}}'), { ok: false, code: 'bad_version' });
assert.equal(acceptSequence(5, 5), false);
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/protocol.test.mjs`

Expected: FAIL because `src/protocol.mjs` does not exist or required exports are absent.

- [ ] **Step 3: Implement minimal protocol helpers**

`parseClientMessage` must never throw. It validates raw type/length before `JSON.parse`, requires a plain object, enforces protocol version/type-specific fields, copies only recognized fields, and returns stable error codes: `bad_message`, `bad_json`, `bad_version`, `bad_type`, `bad_seq`, `bad_dir`, `bad_ping`.

`consumeRateWindow` must be deterministic and side-effect free:

```js
export function consumeRateWindow(state, now, limit, windowMs) {
  const current = state ?? { startedAt: now, count: 0 };
  const reset = !Number.isFinite(current.startedAt) || now - current.startedAt >= windowMs || now < current.startedAt;
  const next = reset ? { startedAt: now, count: 1 } : { startedAt: current.startedAt, count: current.count + 1 };
  return { allowed: next.count <= limit, state: next };
}
```

- [ ] **Step 4: Embed protocol module in the build**

Add a `stripExports(source)` helper in `scripts/build.mjs`, read both `src/game-logic.mjs` and `src/protocol.mjs`, and inject them into a new `/*__PROTOCOL__*/` marker in `src/worker.template.mjs` during Task 4. For this task, update the builder so a missing marker fails loudly instead of silently emitting a broken bundle.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/protocol.test.mjs && npm test && npm run build && node --check dist/worker.mjs`

Expected: protocol tests PASS and existing tests remain PASS.

- [ ] **Step 6: Commit**

```bash
git add src/protocol.mjs tests/protocol.test.mjs scripts/build.mjs
git commit -m "feat: add versioned multiplayer protocol guards"
```

### Task 2: Spatial buckets and deterministic player-eat resolution

**Files:**
- Create: `src/spatial-grid.mjs`
- Create: `tests/spatial-grid.test.mjs`
- Modify: `src/game-logic.mjs`
- Modify: `tests/game-logic.test.mjs`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Produces: `cellKey(position, cellSize)`.
- Produces: `buildSpatialBuckets(items, cellSize, positionOf)` returning `Map<string, Array<item>>`.
- Produces: `nearbyFromBuckets(buckets, position, cellSize)` returning deduplicated items from the 27 neighboring 3D cells.
- Produces: `resolveEatPair(a, b)` returning `'a' | 'b' | null`; if both geometric predicates are simultaneously true due to state overlap, winner is higher mass, then lexicographically smaller stable id as a deterministic tie breaker.

- [ ] **Step 1: Add RED tests for spatial membership and deterministic conflicts**

Cover negative coordinates, cell boundaries, 27-cell neighbor lookup, no duplicates, and an overlap case where equal-mass invalid eat returns null. Add an explicitly synthetic case that stubs two valid candidates with equal mass and requires stable-id ordering in the conflict helper.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/spatial-grid.test.mjs tests/game-logic.test.mjs`

Expected: FAIL on missing spatial exports/conflict resolver.

- [ ] **Step 3: Implement `src/spatial-grid.mjs`**

Use `Math.floor(finiteCoord / cellSize)` for each axis. Reject invalid/non-positive `cellSize` with `RangeError`. `nearbyFromBuckets` loops `dx/dy/dz` from -1 through 1 and uses a `Set` for dedupe.

- [ ] **Step 4: Add `resolveEatPair` to pure game logic**

Do not mutate players. First compute `aCanEatB = canEat(a,b)` and `bCanEatA = canEat(b,a)`. If only one is true return that winner. If neither is true return null. If both are true choose greater finite mass; if masses are equal choose the smaller `String(id)`.

- [ ] **Step 5: Update build embedding for spatial module**

Read `src/spatial-grid.mjs` and inject through `/*__SPATIAL_GRID__*/` during worker assembly.

- [ ] **Step 6: Verify GREEN**

Run: `node --test tests/spatial-grid.test.mjs tests/game-logic.test.mjs && npm test && npm run build && node --check dist/worker.mjs`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/spatial-grid.mjs tests/spatial-grid.test.mjs src/game-logic.mjs tests/game-logic.test.mjs scripts/build.mjs
git commit -m "feat: add deterministic spatial collision helpers"
```

### Task 3: Pure reconnect and room-presence state helpers

**Files:**
- Create: `src/room-state.mjs`
- Create: `tests/room-state.test.mjs`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Produces: `RECONNECT_GRACE_MS = 12000`.
- Produces: `makeResumeKey()` using `crypto.randomUUID()` plus additional random bytes when available; result is opaque and not derived from player name/id.
- Produces: `makeReconnectSlot(player, resumeKey, disconnectedAt)` returning a frozen, non-interactive stored record.
- Produces: `isReconnectSlotExpired(slot, now, graceMs = RECONNECT_GRACE_MS)`.
- Produces: `canResume(slot, resumeKey, now)` using constant-shape string equality and expiry validation.
- Produces: `makeRateState()` returning `{ startedAt: 0, count: 0 }`.

- [ ] **Step 1: Add RED tests**

Require a 12-second grace; a slot is not expired at `disconnectedAt + 11999` and is expired at `+12000`; wrong resume key fails; expired correct key fails; reconnect slots preserve competitive player fields but mark `interactive: false`; generated keys are non-empty and two calls differ.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/room-state.test.mjs`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement helpers without storage/network side effects**

Keep slot data JSON-serializable because Durable Object storage may persist it. Do not store a WebSocket object in the slot.

- [ ] **Step 4: Embed room-state module**

Add `/*__ROOM_STATE__*/` build injection.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/room-state.test.mjs && npm test && npm run build && node --check dist/worker.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/room-state.mjs tests/room-state.test.mjs scripts/build.mjs
git commit -m "feat: add resumable room presence primitives"
```

### Task 4: Integrate hardening into `GameRoom`

**Files:**
- Modify: `src/worker.template.mjs`
- Create: `tests/worker-hardening.test.mjs`
- Modify: `tests/build.test.mjs`

**Interfaces:**
- Consumes protocol/spatial/room-state helpers from Tasks 1-3.
- WebSocket join query accepts `room`, `name`, optional `resume`.
- `welcome` becomes `{ type:'welcome', v:1, id, resumeKey, resumed, room, bounds, snapshot }`.
- Every server protocol message carries `v: 1` except HTTP health JSON, which adds `protocolVersion: 1`.
- Room error codes are stable JSON and never include raw exceptions.

- [ ] **Step 1: Add RED source/build tests**

Tests inspect the built Worker and require: `PROTOCOL_VERSION`, `RECONNECT_GRACE_MS`, `resumeKey`, `bad_version`, `rate_limited`, `bad_seq`, protocol-versioned welcome/snapshot/pong/error paths, reconnect slot storage key, and spatial-bucket collision path. Require the old `const seq = Number.isSafeInteger(message.seq) ? message.seq : player.seq + 1;` fallback to be absent.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/worker-hardening.test.mjs tests/build.test.mjs`

Expected: FAIL because current Worker lacks these guards.

- [ ] **Step 3: Add module markers and hard limits**

At Worker top include:

```js
/*__GAME_LOGIC__*/
/*__PROTOCOL__*/
/*__SPATIAL_GRID__*/
/*__ROOM_STATE__*/
const INPUT_RATE_LIMIT = 25;
const INPUT_RATE_WINDOW_MS = 1000;
const COLLISION_CELL_SIZE = 8;
```

- [ ] **Step 4: Replace permissive message handling**

Each socket attachment gains `rate`, `interactive`, and `resumeKey`. `webSocketMessage` first calls `consumeRateWindow`; if rejected, sends `{type:'error',v:1,code:'rate_limited'}` and does no simulation work. Then call `parseClientMessage`; invalid messages get the returned code. For input, reject non-increasing sequence with explicit `bad_seq` rather than silently accepting/inventing a sequence. Pings do not advance simulation.

- [ ] **Step 5: Make collision resolution deterministic and spatially bounded**

Build buckets from current interactive players. Query only neighboring buckets around the moved player. Sort candidate players by stable `id` before applying `resolveEatPair`. After an eat/respawn mutation, update serialized attachments before evaluating another candidate. Never let one stale peer snapshot be applied twice.

- [ ] **Step 6: Add reconnect slot lifecycle**

On close/error, deserialize the player, convert to non-interactive reconnect slot and store at `reconnect:<resumeKey>` with the disconnect timestamp. On a join carrying `resume`, load that slot; when `canResume` passes, delete the slot, preserve id/name/mass/score/deaths/position, set a fresh `lastAt`, fresh rate state and `interactive:true`, then bind the new socket. If resume fails, create a fresh player with a new key. Capacity counts only active sockets; a resumed identity cannot create a second active socket with the same player id.

- [ ] **Step 7: Bound cleanup without perpetual timers**

Whenever a join/input/close occurs, inspect only the relevant reconnect key or a bounded stored reconnect-key index of at most `MAX_PLAYERS * 2`. Delete expired slots. Do not create a periodic timer. If an alarm is introduced for cleanup, it must schedule only while reconnect slots exist and must clear itself after the index becomes empty.

- [ ] **Step 8: Version all server messages and health metadata**

Snapshots include `v: PROTOCOL_VERSION`. `pong`, `eaten`, `error`, and `welcome` include `v`. `/health` includes `protocolVersion: PROTOCOL_VERSION` and updates app version to `0.2.0`.

- [ ] **Step 9: Verify GREEN**

Run: `npm test && npm run build && node --check dist/worker.mjs && git diff --check`

Expected: every Node test passes; production Worker builds and parses.

- [ ] **Step 10: Commit**

```bash
git add src/worker.template.mjs tests/worker-hardening.test.mjs tests/build.test.mjs
git commit -m "feat: harden authoritative multiplayer rooms"
```

### Task 5: Upgrade browser protocol and reconnect behavior

**Files:**
- Modify: `public/app.js`
- Modify: `public/index.html`
- Modify: `tests/build.test.mjs`

**Interfaces:**
- Client stores `abyss-eater-resume:<room>` in `sessionStorage`, not long-term profile storage.
- Client sends `{type:'input',v:1,seq,dir}` and `{type:'ping',v:1,t}`.
- On `welcome`, client persists `resumeKey`; on a reconnect attempt for the same room it sends `?resume=<opaque>`.
- `resumed:true` keeps the same local fish identity and avoids a false “new ocean” toast.

- [ ] **Step 1: Add RED build assertions**

Require `PROTOCOL_VERSION = 1`, `sessionStorage`, `resume`, outgoing `v: PROTOCOL_VERSION`, incoming version guard, and explicit `Upgrade required` UI text/path.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/build.test.mjs`

Expected: FAIL on missing client protocol markers.

- [ ] **Step 3: Implement browser protocol constants and resume query**

Declare `const PROTOCOL_VERSION = 1;`. Before opening WebSocket, read `sessionStorage.getItem('abyss-eater-resume:' + room)` and append `resume` only when non-empty. Outgoing input/ping include `v`.

- [ ] **Step 4: Guard incoming messages**

For all game protocol messages except intentionally unversioned legacy errors, require `message.v === PROTOCOL_VERSION`. On mismatch close the socket, stop reconnect looping for that attempt, set status to `Upgrade required`, and show a reload toast. Do not apply mismatched snapshots.

- [ ] **Step 5: Persist the rotated resume key**

On `welcome`, write `message.resumeKey` to the room-scoped sessionStorage key. When `resumed` is true show `Reconnected to your fish`; otherwise show `You entered the ocean`.

- [ ] **Step 6: Verify GREEN**

Run: `npm test && npm run build && node --check dist/worker.mjs && git diff --check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add public/app.js public/index.html tests/build.test.mjs
git commit -m "feat: add versioned client reconnect flow"
```

### Task 6: Carrier 1 release gates, documentation and deployment

**Files:**
- Modify: `README.md`
- Create: `docs/runbooks/multiplayer-hardening.md`
- Modify: `.github/workflows/ci.yml` only if a new explicit test command is needed; otherwise leave it unchanged because `npm test` already discovers all `tests/*.test.mjs`.

**Interfaces:**
- Carrier release version: `0.2.0`.
- Production artifact: `dist/worker.mjs`.
- Deployment binding remains `GAME_ROOM -> GameRoom` with existing SQLite Durable Object migration lineage.

- [ ] **Step 1: Document the new protocol and reconnect contract**

README/runbook must state protocol `v=1`, 25 messages/second/window guard, 12-second transient reconnect grace, non-interactive disconnected fish behavior, 20-player cap, JSON compatibility baseline, and no perpetual Durable Object simulation timer.

- [ ] **Step 2: Run full fresh local gate**

Run exactly:

```bash
npm test
npm run build
node --check dist/worker.mjs
git diff --check
```

Expected: zero test failures and all commands exit 0.

- [ ] **Step 3: Push carrier branch and open PR against `main`**

PR description includes root changes, protocol compatibility, security/rate behavior, reconnect semantics, tests, Cloudflare cost boundary and rollback notes.

- [ ] **Step 4: Require GitHub Actions GREEN on exact PR head**

Verify Node 22 `test-and-build` passes Test, Build Worker and Syntax check. Fix candidate-caused failures; never merge red/pending CI.

- [ ] **Step 5: Merge to `main` and verify exact main head**

Use normal merge/rebase/squash allowed by repository settings without force-push. Fetch `main` after merge and record merge SHA/tree SHA.

- [ ] **Step 6: Build exact merged source and compare artifact hash before deploy**

SHA-256 the locally/reproducibly built `dist/worker.mjs`. Upload that exact artifact to Worker `abyss-eater` on account `trinhtanphat6666`; do not alter paid-plan settings.

- [ ] **Step 7: Verify Cloudflare deployment metadata and artifact identity**

Confirm latest deployment receives 100% traffic, `GameRoom` binding/migration remain valid, workers.dev is enabled, and downloading production Worker content yields the same SHA-256 as the merged build.

- [ ] **Step 8: Verify gateway remains unchanged unless origin contract required an explicit compatible change**

If unchanged, hash gateway production and repository source to confirm they still match. Confirm `abyss-eater.qs3d.site` custom domain remains enabled/proxied.

- [ ] **Step 9: Live probe when a network-capable probe path is available**

Require `/health` HTTP 200 with version `0.2.0` and protocolVersion `1`; home HTTP 200; WebSocket join receives versioned welcome; versioned ping receives pong; one versioned input yields a snapshot. If the current sandbox cannot resolve public DNS, label this specific gate `NO_RESULT` rather than fabricating PASS.

- [ ] **Step 10: Commit final docs if adjusted during release verification**

```bash
git add README.md docs/runbooks/multiplayer-hardening.md .github/workflows/ci.yml
git commit -m "docs: qualify multiplayer hardening carrier"
```
