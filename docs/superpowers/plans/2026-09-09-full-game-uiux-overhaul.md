# Abyss Eater Full Game UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase A Stylized Premium Ocean first, then add Phase B Realistic Deep Sea as a switchable presentation mode, while preserving the existing server-authoritative multiplayer protocol.

**Architecture:** Keep the Worker/server rules unchanged. Split the current monolithic browser client into focused ES modules for pure presentation state, themes, scene/environment, fish rendering, effects, input/network, lobby and HUD. Extend the production bundler so every browser module is embedded and served by the Worker.

**Tech Stack:** Browser ES modules, Three.js 0.185.1, DOM/CSS, Node 22 built-in test runner, Cloudflare Worker bundle script.

**Spec:** `docs/superpowers/specs/2026-09-09-full-game-uiux-overhaul-design.md`

## Global Constraints

- Phase A is complete before Phase B is implemented.
- `Stylized` is the default theme; `Deep Sea` is additive and must not replace it.
- Do not change server-authoritative movement, collision, eating, respawn or scoring rules.
- Do not add paid services or paid assets.
- Keep the client dependency-light; no framework/game-engine migration.
- Keep all production browser files bundled into `dist/worker.mjs`.
- Respect reduced motion and mobile/coarse-pointer constraints.

---

### Task 1: Pure presentation state and TDD contract

**Files:**
- Create: `tests/presentation.test.mjs`
- Create: `public/game/presentation.js`

**Interfaces:**
- Produces `normalizeTheme(value) -> 'stylized' | 'deep-sea'`.
- Produces `normalizeQuality(value) -> 'auto' | 'high' | 'balanced' | 'low'`.
- Produces `growthProgress(mass) -> number` in `[0, 1]`.
- Produces `leaderboard(players, clientId, limit) -> rows` sorted by score then mass.
- Produces `dangerLevel(players, clientId, radius) -> { level, threat }`.
- Produces `normalizePlanarInput({x,z}) -> {x,z}` capped to vector length 1.

- [ ] **Step 1: Write the failing tests** covering normalization, sorting, danger detection, progress clamping and vector normalization.
- [ ] **Step 2: Run `npm test`** and confirm RED because `public/game/presentation.js` does not exist.
- [ ] **Step 3: Implement the pure functions** with no browser/Three.js dependencies.
- [ ] **Step 4: Run `npm test`** and confirm GREEN.
- [ ] **Step 5: Commit** as `feat(ui): add presentation state primitives`.

### Task 2: Production asset bundling for modular client

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `tests/build.test.mjs`

**Interfaces:**
- The Worker must serve `/game/*.js` and `/ui/*.js` modules used by `app.js`.

- [ ] **Step 1: Extend build tests** to assert representative modular routes such as `"/game/presentation.js"`, `"/game/themes.js"`, `"/game/fish.js"`, `"/ui/hud.js"` and `"/ui/lobby.js"` exist in the bundle.
- [ ] **Step 2: Run `npm test`** and confirm RED because those assets are not bundled.
- [ ] **Step 3: Replace the fixed four-file asset map** with recursive discovery of UTF-8 files under `public/`, preserving `/` for `index.html` and MIME types for `.js`, `.css`, `.html`, `.webmanifest`.
- [ ] **Step 4: Run `npm test` and `npm run build`** and confirm GREEN.
- [ ] **Step 5: Commit** as `build: bundle modular game client assets`.

### Task 3: Phase A lobby, HUD and responsive interaction shell

**Files:**
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Create: `public/ui/lobby.js`
- Create: `public/ui/hud.js`
- Create: `public/ui/toast.js`
- Create: `public/game/state.js`

**Interfaces:**
- Lobby persists nickname, room, theme and quality.
- HUD renders mass/progress, score, rank, players, ping, room, depth, leaderboard and danger state.

- [ ] **Step 1: Add build/static assertions** for theme selector, quality selector, leaderboard, depth meter and joystick hooks.
- [ ] **Step 2: Confirm RED** on the feature PR CI.
- [ ] **Step 3: Implement semantic lobby/HUD DOM** with accessible labels and no blocking respawn modal.
- [ ] **Step 4: Implement responsive glass UI** with visible focus, safe-area support and reduced-motion rules.
- [ ] **Step 5: Implement lobby/HUD modules** using the pure presentation functions.
- [ ] **Step 6: Confirm tests/build GREEN.**
- [ ] **Step 7: Commit** as `feat(ui): overhaul lobby and multiplayer HUD`.

### Task 4: Phase A stylized ocean, procedural fish and feedback

**Files:**
- Create: `public/game/config.js`
- Create: `public/game/themes.js`
- Create: `public/game/scene.js`
- Create: `public/game/environment.js`
- Create: `public/game/fish.js`
- Create: `public/game/effects.js`
- Modify: `public/app.js`

**Interfaces:**
- `themes.js` exports theme definitions with `stylized` as default.
- `fish.js` exports a procedural rig and animation/update functions.
- `environment.js` owns decorative non-colliding ocean scenery.
- `effects.js` owns bounded transient visual effects.

- [ ] **Step 1: Add static build assertions** for stylized/deep-sea theme identifiers, fish rig parts and effect hooks.
- [ ] **Step 2: Confirm RED.**
- [ ] **Step 3: Implement renderer/quality configuration** including DPR caps.
- [ ] **Step 4: Implement the Stylized theme** with layered fog/light palette.
- [ ] **Step 5: Implement reusable procedural fish rig** with body, tail, dorsal/pectoral/ventral fins, eyes/pupils and mouth marker.
- [ ] **Step 6: Animate tail/fins from movement speed** and keep cube-root mass scaling.
- [ ] **Step 7: Implement seabed, rocks, coral, kelp, bubbles, plankton and light shafts** using shared geometry/materials where practical.
- [ ] **Step 8: Implement bounded food/eat/growth/danger effects** and camera impulse with reduced-motion suppression.
- [ ] **Step 9: Refactor `app.js` into bootstrap/orchestration** while keeping the existing WebSocket protocol compatible.
- [ ] **Step 10: Confirm tests/build GREEN.**
- [ ] **Step 11: Commit** as `feat(game): ship stylized premium ocean experience`.

### Task 5: Input and mobile control upgrade

**Files:**
- Create: `public/game/input.js`
- Create: `public/game/network.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`

**Interfaces:**
- Keyboard remains WASD/arrows + Space/Shift.
- Pointer steering maps displacement from screen center to planar input with a dead zone.
- Touch joystick maps pointer displacement to normalized planar input; vertical up/down remain explicit buttons.

- [ ] **Step 1: Add static assertions** for joystick pointer hooks and pointer steering preference.
- [ ] **Step 2: Confirm RED.**
- [ ] **Step 3: Move WebSocket lifecycle into `network.js`** without changing protocol messages.
- [ ] **Step 4: Implement keyboard + pointer steering + analog joystick** with UI-interaction suppression.
- [ ] **Step 5: Confirm tests/build GREEN.**
- [ ] **Step 6: Commit** as `feat(input): add pointer steering and analog touch controls`.

### Task 6: Phase B Realistic Deep Sea mode

**Files:**
- Modify: `public/game/themes.js`
- Modify: `public/game/environment.js`
- Modify: `public/game/fish.js`
- Modify: `public/ui/lobby.js`
- Modify: `public/styles.css`

**Interfaces:**
- Theme selector persists `deep-sea` and can apply presentation without reconnecting.
- Same geometry/state/network contracts are reused.

- [ ] **Step 1: Add presentation tests** proving `deep-sea` normalization/persistence contract and build markers.
- [ ] **Step 2: Confirm RED** for missing Deep Sea implementation markers.
- [ ] **Step 3: Implement Deep Sea palette** with denser fog, lower saturation, tighter light shafts and subtler emission.
- [ ] **Step 4: Implement theme-aware fish material response and environment density** within the selected quality budget.
- [ ] **Step 5: Make live theme switching update scene/environment/fish materials without reconnecting.**
- [ ] **Step 6: Confirm tests/build GREEN.**
- [ ] **Step 7: Commit** as `feat(theme): add realistic deep sea mode`.

### Task 7: Verification and branch delivery

**Files:**
- Modify only if verification exposes defects.

- [ ] **Step 1: Run `npm test`.** Expected: all tests pass.
- [ ] **Step 2: Run `npm run build`.** Expected: `dist/worker.mjs` builds successfully.
- [ ] **Step 3: Run `node --check dist/worker.mjs`.** Expected: no syntax errors.
- [ ] **Step 4: Inspect PR workflow run** and require `test-and-build` GREEN.
- [ ] **Step 5: Compare feature branch to `main`** and verify only intended UI/game client/build/test/docs changes exist.
- [ ] **Step 6: Leave the branch pushed and PR unmerged** for user review.
