# Abyss Eater V1 Carrier 5 Social and Matchmaking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded Quick Dive matchmaking, private-room compatibility, transient parties, safe room chat, local mute, and durable abuse reports without changing protocol v2 gameplay authority.

**Architecture:** Keep `GameRoom` authoritative for gameplay and room chat. Add focused `Matchmaker` and `Party` Durable Objects with deterministic pure helpers embedded by the existing build-marker pipeline. HTTPS social APIs validate opaque sessions where identity is required; chat rides the existing WebSocket as an additive versioned message and never enters movement snapshots.

**Tech Stack:** Node.js 22 ESM, Cloudflare Workers + Durable Objects, D1, Three.js client, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-09-abyss-eater-v1-full-abc-design.md`

## Global Constraints

- Keep protocol version `2`; social messages are additive.
- Public room target stays 20 players; party size is capped at 4.
- Region buckets are exactly `SEA`, `JP`, `EU`, `NA`, `OTHER`.
- No perpetual DO timers and no D1 write per chat message/input/snapshot.
- Chat max length 160, separate bounded rate limit, duplicate suppression, deterministic prohibited-term filter, text only.
- Reports require validated persistent identity and store bounded metadata only; no raw session credentials.
- GitHub Actions remains CI-only; no production deploy workflow or paid service is introduced.

---

### Task 1: Pure matchmaking and chat rules
**Files:** Create `src/matchmaking.mjs`, `src/chat.mjs`; Test `tests/matchmaking.test.mjs`, `tests/chat-moderation.test.mjs`.
- [ ] Write RED tests for region mapping, capacity-aware room selection, canonical private labels, chat normalization/rate/duplicate/prohibited filtering.
- [ ] Run targeted tests and confirm missing modules fail.
- [ ] Implement pure helpers with hard caps and deterministic output.
- [ ] Run targeted tests GREEN and commit.

### Task 2: Matchmaker and Party Durable Objects
**Files:** Modify `src/worker.template.mjs`, `scripts/build.mjs`, `wrangler.jsonc`; Create `tests/social-worker-integration.test.mjs`.
- [ ] Write RED integration assertions for exported `Matchmaker`/`Party`, bindings, migration tag, and `/api/matchmaking/quick` + `/api/party/*` routes.
- [ ] Implement Matchmaker room registry with timestamp TTL and capacity records updated by meaningful join/leave activity.
- [ ] Implement Party state with leader, max 4 unique profile ids, invite code, join/leave/status and leader-only Quick Dive placement.
- [ ] Keep private named rooms on the existing `roomIdFor()` path.
- [ ] Run targeted tests/build/syntax GREEN and commit.

### Task 3: Room chat, mute-compatible events, and reports
**Files:** Modify `src/protocol.mjs`, `src/worker.template.mjs`, `src/profile-store.mjs`; Create `migrations/0003_moderation_reports.sql`; Test `tests/chat-worker-integration.test.mjs`, `tests/moderation-report.test.mjs`.
- [ ] Write RED tests for additive `chat` client message, server `chat` event, independent chat rate state, duplicate suppression, and report persistence.
- [ ] Implement sanitized text-only chat broadcast outside snapshots; never log raw chat or tokens.
- [ ] Add report API requiring bearer session, bounded target/reason, and D1 insert only on explicit report action.
- [ ] Run targeted persistence/protocol/build tests GREEN and commit.

### Task 4: Quick Dive, party, chat, and local mute client UX
**Files:** Create `public/client-social.mjs`; Modify `public/game/network.js`, `public/ui/lobby.js`, `public/index.html`, `public/styles.css`, `public/app.js`, `public/sw.js`; Test `tests/client-social.test.mjs`.
- [ ] Write RED tests for Quick Dive control, private room fallback, party panel, chat log/form, local mute, report action, and network `sendChat()`.
- [ ] Implement social API client using the existing opaque session token; no profile-id authority in browser requests.
- [ ] Quick Dive resolves room before WebSocket connect; on matchmaking failure fall back only for non-party play.
- [ ] Render chat via `textContent`; mute is local-only and bounded in local storage.
- [ ] Cache the new same-origin module and run client/static tests GREEN.

### Task 5: Qualification and documentation
**Files:** Modify `README.md`; Add/update Carrier 5 test gates.
- [ ] Run `npm run check` and `git diff --check`.
- [ ] Verify no `setInterval(` in `src`, no production deploy workflow, no session token logging, no client-submitted chat HTML/score/profile ids.
- [ ] Verify generated Worker exports all three DO classes and Wrangler config retains `GameRoom`, `Matchmaker`, `Party`.
- [ ] Update README architecture/features and commit.
- [ ] Push branch, open PR, require exact-head CI GREEN, merge with expected-head SHA, then require post-merge CI GREEN.
