# Predator Loop + Scoreboard + UIUX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the core “big fish eats small fish” loop visible and playable even in a low-population room, keep it server-authoritative, and make the live scoreboard visible on desktop and mobile.

**Architecture:** Add a bounded server-owned wildlife population to `GameRoom`. Wildlife uses pure, testable movement/behavior helpers, is stepped at a capped cadence from room activity, and participates in the existing authoritative mass/eating rules. The client preserves wildlife across delta snapshots, renders it with the existing procedural fish rig at true sub-1 and >1 scale, includes wildlife in danger/ecosystem indicators, and keeps the player leaderboard visible in responsive HUD layouts.

**Tech Stack:** Cloudflare Workers + Durable Objects, Node.js 22 `node:test`, Three.js browser client, static HTML/CSS/ES modules.

**Spec:** `docs/superpowers/specs/2026-09-09-abyss-eater-v1-full-abc-design.md`

## Global Constraints

- Server remains authoritative for position, movement speed, mass, collision/eating, AI state, score and respawn.
- AI population and work are strictly bounded per room; no unbounded timers or loops.
- Hot gameplay does not write D1 every tick.
- No paid-only Cloudflare products or external paid inference/services are introduced.
- Existing protocol v2 remains compatible; omitted wildlife in a delta snapshot means “preserve previous wildlife state”, not “clear wildlife”.
- Existing player-vs-player eating semantics remain unchanged except that valid edible wildlife may have mass below the player start mass.

---

### Task 1: Wildlife rules and edible sub-starter fish

**Files:**
- Create: `src/wildlife.mjs`
- Modify: `src/game-logic.mjs`
- Test: `tests/game-logic.test.mjs`
- Test: `tests/wildlife.test.mjs`

**Interfaces:**
- Produces: `WILDLIFE_COUNT`, `WILDLIFE_STEP_MS`, `makeWildlifePopulation(spawnPoint, idFactory)`, `stepWildlife(population, players, dt, bounds, now)`, `respawnWildlife(actor, spawnPoint)`.
- Consumes: existing `canEat`, `clampDirection`, `radiusForMass` semantics from `src/game-logic.mjs`.

- [ ] **Step 1: Write failing tests**

```js
assert.equal(canEat(
  { mass: 1, position: { x: 0, y: 0, z: 0 } },
  { mass: 0.6, position: { x: 0.5, y: 0, z: 0 } },
), true);

const wildlife = makeWildlifePopulation(
  () => ({ x: 0, y: 0, z: 0 }),
  (() => { let i = 0; return () => `wild-${++i}`; })(),
);
assert.ok(wildlife.some((fish) => fish.mass < 0.85));
assert.ok(wildlife.some((fish) => fish.mass > 1.3));
assert.equal(wildlife.length, WILDLIFE_COUNT);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`
Expected: FAIL because `src/wildlife.mjs` and sub-starter edible mass support do not exist yet.

- [ ] **Step 3: Implement minimal wildlife helpers and edible mass floor**

```js
export const MIN_EDIBLE_MASS = 0.2;

export function canEat(predator, prey) {
  if (!predator || !prey || predator === prey) return false;
  if (!Number.isFinite(predator.mass) || !Number.isFinite(prey.mass)) return false;
  if (predator.mass < MIN_EDIBLE_MASS || prey.mass < MIN_EDIBLE_MASS) return false;
  if (predator.mass < prey.mass * 1.15) return false;
  const reach = radiusForMass(predator.mass) + radiusForMass(prey.mass) * 0.35;
  return distance3(predator.position, prey.position) <= reach;
}
```

`src/wildlife.mjs` uses a fixed tier cycle containing prey below starter size and predators above starter size, stores a heading/seed per actor, and caps motion inside `bounds`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test`
Expected: wildlife and game-logic tests PASS with the full suite still green.

- [ ] **Step 5: Commit**

```bash
git add src/game-logic.mjs src/wildlife.mjs tests/game-logic.test.mjs tests/wildlife.test.mjs
git commit -m "feat: add bounded server wildlife rules"
```

---

### Task 2: Integrate wildlife into authoritative GameRoom snapshots and eating

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `src/worker.template.mjs`
- Test: `tests/build.test.mjs`
- Test: `tests/worker-hardening.test.mjs`

**Interfaces:**
- Consumes: Task 1 wildlife helpers.
- Produces: `snapshot.wildlife` on full/dirty wildlife snapshots; player-vs-wildlife consumption and wildlife-vs-player respawn events.

- [ ] **Step 1: Write failing integration tests**

```js
assert.ok(buildScript.includes("readFile('src/wildlife.mjs'"));
assert.ok(template.includes('/*__WILDLIFE__*/'));
assert.ok(template.includes('this.wildlife'));
assert.ok(template.includes('stepWildlife('));
assert.ok(template.includes('wildlifeDirty'));
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`
Expected: FAIL because the build/template have no wildlife marker or authoritative wildlife state.

- [ ] **Step 3: Implement authoritative integration**

`GameRoom` initializes a bounded wildlife array, steps it no more frequently than `WILDLIFE_STEP_MS`, includes wildlife only when dirty (or on welcome/full snapshot), and resolves collisions using existing `resolveEatPair` logic. Eating wildlife grows player mass and score; a larger wildlife actor can respawn a player and emits the existing `eaten` event.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build && node --check dist/worker.mjs`
Expected: all commands PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build.mjs src/worker.template.mjs tests/build.test.mjs tests/worker-hardening.test.mjs
git commit -m "feat: integrate authoritative wildlife simulation"
```

---

### Task 3: Render true fish-size variety and preserve wildlife deltas

**Files:**
- Modify: `public/game/state.js`
- Modify: `public/game/fish.js`
- Modify: `public/app.js`
- Modify: `public/game/presentation.js`
- Test: `tests/premium-presentation-integration.test.mjs`
- Test: `tests/presentation.test.mjs`
- Test: `tests/premium-runtime-regressions.test.mjs`

**Interfaces:**
- Produces: client `snapshot.wildlife`, wildlife rigs, `ecosystemSummary(entities, clientId)`.
- Consumes: authoritative wildlife snapshots from Task 2.

- [ ] **Step 1: Write failing client tests**

```js
assert.ok(stateSource.includes('Array.isArray(next.wildlife) ? next.wildlife : snapshot.wildlife'));
assert.ok(fishSource.includes('Math.max(0.2, Number(player.mass) || 1)'));

const summary = ecosystemSummary([
  { id: 'me', mass: 1 },
  { id: 'prey', mass: 0.6 },
  { id: 'threat', mass: 2 },
], 'me');
assert.deepEqual(summary, { prey: 1, threats: 1 });
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`
Expected: FAIL because wildlife persistence/rendering and ecosystem summary are missing.

- [ ] **Step 3: Implement client rendering**

The client keeps separate wildlife meshes, reuses `createFishRig`, allows visual mass below 1, disposes wildlife rigs when removed, and includes wildlife in danger/ecosystem calculations while keeping the leaderboard player-only.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test`
Expected: all client and presentation tests PASS.

- [ ] **Step 5: Commit**

```bash
git add public/game/state.js public/game/fish.js public/app.js public/game/presentation.js tests/premium-presentation-integration.test.mjs tests/presentation.test.mjs tests/premium-runtime-regressions.test.mjs
git commit -m "feat: render wildlife size hierarchy"
```

---

### Task 4: Make scoreboard visible and improve hunt/readability HUD

**Files:**
- Modify: `public/index.html`
- Modify: `public/ui/hud.js`
- Modify: `public/styles.css`
- Test: `tests/predator-loop-ui.test.mjs`

**Interfaces:**
- Consumes: `ecosystemSummary` from Task 3 and player leaderboard rows.
- Produces: persistent responsive scoreboard plus `Edible` and `Threats` HUD metrics.

- [ ] **Step 1: Write failing static/UI tests**

```js
assert.ok(html.includes('id="hud-prey"'));
assert.ok(html.includes('id="hud-threats"'));
assert.ok(css.includes('.leaderboard-card'));
assert.equal(/\.leaderboard-card\s*\{\s*display:\s*none/.test(css), false);
assert.ok(hudSource.includes('ecosystemSummary'));
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`
Expected: FAIL because responsive scoreboard is hidden on narrow screens and ecosystem HUD metrics do not exist.

- [ ] **Step 3: Implement HUD/UIUX pass**

Keep the top-predator board visible on narrow screens in a compact 3-row form, add edible/threat counts beside score/rank, and preserve touch-control clearance/safe areas. Desktop continues to show the full top-5 board.

- [ ] **Step 4: Run full verification**

Run: `npm test && npm run build && node --check dist/worker.mjs`
Expected: full suite PASS, production Worker syntax valid.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/ui/hud.js public/styles.css tests/predator-loop-ui.test.mjs
git commit -m "feat: surface predator scoreboard and hunt HUD"
```
