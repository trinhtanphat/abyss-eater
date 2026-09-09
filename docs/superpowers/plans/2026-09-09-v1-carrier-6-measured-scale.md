# Carrier 6 Measured Scale Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure the protocol-v2 JSON path at V1 room caps, improve client smoothness and background efficiency, and activate binary snapshots only if measured evidence shows JSON is materially limiting.

**Architecture:** Keep JSON/protocol v2 as the compatibility baseline. Add deterministic offline profiling utilities and bounded runtime serialization measurements without exposing a public debug endpoint. Add time-based remote interpolation and pause routine input/ping work while the document is hidden; never move gameplay authority to the client.

**Tech Stack:** Node.js 22 ESM, Cloudflare Workers/Durable Objects, Three.js client, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-09-abyss-eater-v1-full-abc-design.md`

## Global Constraints

- Measure average snapshot bytes, p95 bytes, player count, messages/sec and serialization cost before considering binary snapshots.
- JSON protocol v2 remains active unless profiling shows a material limit.
- No public admin/debug endpoint, no perpetual Durable Object timer, no D1 write per movement input.
- Client interpolation/prediction must remain visual-only and never mutate authoritative score/mass/collision state.
- GitHub Actions remains CI-only and Cloudflare deployment remains main-driven.

---

### Task 1: Deterministic network profiling and evidence

**Files:** Create `src/network-metrics.mjs`, `scripts/profile-network.mjs`, `tests/network-metrics.test.mjs`, `tests/network-profile.test.mjs`; modify `package.json`.

- [ ] Write RED tests for bounded sample summaries, average/p95 snapshot bytes, messages/sec, player counts and serialization timing.
- [ ] Add a deterministic 1/10/20-player JSON snapshot profile harness using the current public snapshot shape.
- [ ] Define explicit evidence thresholds and make the harness report `binaryRecommended: false|true` without implementing a codec.
- [ ] Run targeted tests and the profile script; save the measured evidence in docs and commit.
### Task 2: Time-based remote interpolation

**Files:** Create `public/game/interpolation.mjs`; modify `public/game/fish.js`, `public/app.js`, `public/sw.js`; create `tests/client-interpolation.test.mjs`.

- [ ] Write RED tests for a bounded two-sample interpolation buffer, render-delay clamping and frame-rate-independent easing.
- [ ] Remote fish use buffered server-time samples; local fish keep the latest authoritative target and existing visual smoothing.
- [ ] Preserve mass/score/death/skin authority from the newest snapshot; interpolate position only.
- [ ] Cache the new module and run client/static regressions before commit.

### Task 3: Background-tab throttling and runtime serialization metrics

**Files:** Modify `public/app.js`, `src/worker.template.mjs`, `scripts/build.mjs`; create `tests/scale-runtime.test.mjs`.

- [ ] Write RED tests proving hidden tabs skip routine movement input and ping sends while realtime reconnect behavior remains intact.
- [ ] Replace unconditional input/ping intervals with visibility-aware callbacks; do not disconnect solely because the tab is hidden.
- [ ] Wrap snapshot serialization with a bounded in-memory metric accumulator and emit a structured aggregate only at a coarse sample interval; never include tokens/chat/player names.
- [ ] Ensure instrumentation is not a public API and does not write Durable Object storage or D1.

### Task 4: Qualification and binary decision

**Files:** Create `docs/performance/carrier-6-network-profile.md`, modify `README.md`; create/update Carrier 6 qualification tests.

- [ ] Run `npm run profile:network`, `npm run check`, and `git diff --check`.
- [ ] If 20-player JSON remains below the documented byte/serialization budgets, record binary as evidence-deferred and add no binary codec.
- [ ] If a threshold is exceeded, add a separate negotiated-codec task before merge rather than silently changing protocol behavior.
- [ ] Verify no client gameplay authority, no public debug endpoint, no new production deploy workflow and no paid service.
- [ ] Push branch, open PR, require exact-head CI/Visual Review GREEN, merge with expected-head SHA and require post-merge CI GREEN.
