# Abyss Eater V1 Carrier 4 World and AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing single-volume ocean into a server-authoritative four-biome world with bounded AI states, hazards, pickups, and matching procedural client presentation without adding paid services or unbounded Durable Object work.

**Architecture:** Extend the existing pure simulation modules instead of replacing the GameRoom architecture. New world/actor modules remain deterministic and unit-testable, are embedded into the Worker through the existing build-marker pipeline, and advance only from bounded gameplay work. Client additions consume additive snapshot fields and never choose biome, AI state, hazard outcomes, pickup rewards, or gameplay modifiers.

**Tech Stack:** Node.js 22 ESM, Cloudflare Workers + Durable Objects, Three.js 0.185.1, WebSocket protocol v2, existing spatial-grid helpers, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-09-abyss-eater-v1-full-abc-design.md`

## Global Constraints

- Baseline source is `main` commit `6e189637c91f053dfb15b77cff7941152c18658c`.
- Keep protocol v2 compatible; Carrier 4 snapshot fields are additive only.
- `GameRoom` remains sole authority for position, biome, food, pickups, hazards, AI state, score, respawn and temporary buffs.
- Keep `WILDLIFE_COUNT = 24` and `WILDLIFE_STEP_MS = 250`; do not add a perpetual Durable Object timer.
- Reuse `buildSpatialBuckets()` / `nearbyFromBuckets()` for proximity work before adding any heavier spatial structure.
- No D1 write per input, movement tick, AI step, hazard collision or pickup collision.
- No real-money path, paid inference, paid moderation, or intentionally enabled paid Cloudflare product.
- Free-tier exhaustion must fail/degrade rather than silently switching to a billable service.
- Client decoration and biome effects are presentation only; collision shapes and rewards stay server-owned.
- Existing fish evolution, cosmetic skins, reconnect semantics, TTS, accessibility controls and quality presets must remain compatible.
- Production deployment remains fail-closed while Cloudflare credentials are absent; Carrier 4 may merge on CI evidence but is not labeled live until Carrier 7 qualification.

---

### Task 1: Deterministic biome model

**Files:**
- Create: `src/world.mjs`
- Create: `tests/world-biomes.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `src/worker.template.mjs`

**Interfaces:**
- Consumes: world bounds `{ x, y, z }` already owned by `GameRoom`.
- Produces: `BIOME_IDS`, `normalizedDepth(position, bounds)`, `biomeForPosition(position, bounds)`, `biomeProfile(id)`, `spawnPointInBiome(id, bounds, random)`.

- [ ] **Step 1: Write failing biome tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as world from '../src/world.mjs';

const bounds = { x: 80, y: 28, z: 80 };

test('biome membership is derived only from bounded server depth', () => {
  assert.equal(world.biomeForPosition({ y: 28 }, bounds), 'surface');
  assert.equal(world.biomeForPosition({ y: 10 }, bounds), 'reef');
  assert.equal(world.biomeForPosition({ y: -5 }, bounds), 'deep');
  assert.equal(world.biomeForPosition({ y: -24 }, bounds), 'abyss');
  assert.equal(world.biomeForPosition({ y: Number.NaN }, bounds), 'reef');
});

test('biome profiles expose bounded density and risk metadata', () => {
  assert.deepEqual(world.BIOME_IDS, ['surface', 'reef', 'deep', 'abyss']);
  assert.ok(world.biomeProfile('abyss').risk > world.biomeProfile('surface').risk);
  assert.ok(world.biomeProfile('deep').pickupWeight >= world.biomeProfile('reef').pickupWeight);
});

test('biome spawn points stay inside their authoritative depth band', () => {
  const point = world.spawnPointInBiome('abyss', bounds, () => 0.5);
  assert.equal(world.biomeForPosition(point, bounds), 'abyss');
  assert.ok(Math.abs(point.x) <= bounds.x && Math.abs(point.z) <= bounds.z);
});
```

- [ ] **Step 2: Run the biome test and verify RED**

Run: `node --test tests/world-biomes.test.mjs`

Expected: FAIL because `src/world.mjs` does not exist or required exports are missing.

- [ ] **Step 3: Implement the pure biome model**

Use normalized depth `0` at the top and `1` at the bottom. Fixed bands are Surface `[0,.25)`, Reef `[.25,.5)`, Deep `[.5,.75)`, Abyss `[.75,1]`.

```js
export const BIOME_IDS = Object.freeze(['surface', 'reef', 'deep', 'abyss']);

const PROFILES = Object.freeze({
  surface: Object.freeze({ id: 'surface', minDepth: 0, maxDepth: 0.25, risk: 0.15, foodWeight: 1, pickupWeight: 0.5 }),
  reef: Object.freeze({ id: 'reef', minDepth: 0.25, maxDepth: 0.5, risk: 0.35, foodWeight: 1.25, pickupWeight: 0.8 }),
  deep: Object.freeze({ id: 'deep', minDepth: 0.5, maxDepth: 0.75, risk: 0.65, foodWeight: 1.4, pickupWeight: 1.1 }),
  abyss: Object.freeze({ id: 'abyss', minDepth: 0.75, maxDepth: 1, risk: 1, foodWeight: 1.55, pickupWeight: 1.35 }),
});

export function normalizedDepth(position = {}, bounds = {}) {
  const halfHeight = Math.max(1, Math.abs(Number(bounds.y)) || 28);
  const y = Number.isFinite(position.y) ? position.y : 0;
  return Math.max(0, Math.min(1, (halfHeight - y) / (halfHeight * 2)));
}

export function biomeForPosition(position, bounds) {
  const depth = normalizedDepth(position, bounds);
  if (depth < 0.25) return 'surface';
  if (depth < 0.5) return 'reef';
  if (depth < 0.75) return 'deep';
  return 'abyss';
}
```

`spawnPointInBiome()` must clamp x/z to `72%` of current room bounds and choose y strictly inside the chosen profile band so a round-trip through `biomeForPosition()` returns the requested id.

- [ ] **Step 4: Embed the module in the Worker build**

Add to `scripts/build.mjs`:

```js
const world = stripModuleSyntax(await readFile('src/world.mjs', 'utf8'));
template = replaceRequired(template, '/*__WORLD__*/', world);
```

Add `/*__WORLD__*/` in `src/worker.template.mjs` before wildlife code so later stripped modules can use biome helpers.

- [ ] **Step 5: Run tests/build and commit Task 1**

Run:

```bash
node --test tests/world-biomes.test.mjs
npm run build
node --check dist/worker.mjs
git diff --check
```

Expected: all PASS.

Commit:

```bash
git add src/world.mjs tests/world-biomes.test.mjs scripts/build.mjs src/worker.template.mjs
git commit -m "feat: add authoritative ocean biomes"
```

---

### Task 2: Bounded wildlife behavior state machine

**Files:**
- Modify: `src/wildlife.mjs`
- Create: `tests/wildlife-state-machine.test.mjs`
- Modify: `src/worker.template.mjs`

**Interfaces:**
- Consumes: `biomeForPosition()`, `buildSpatialBuckets()`, `nearbyFromBuckets()`, existing `stepWildlife(population, players, dt, bounds, now)` call shape.
- Produces: public actor fields `behavior`, `aiState`, `biome`; `wildlifeBehaviorFor(actor)`; `stepWildlife()` that updates at most `WILDLIFE_UPDATE_BUDGET = 8` actors per 250 ms step.

- [ ] **Step 1: Write failing AI behavior tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWildlifePopulation, stepWildlife, wildlifeBehaviorFor, WILDLIFE_UPDATE_BUDGET } from '../src/wildlife.mjs';

const bounds = { x: 80, y: 28, z: 80 };

test('wildlife catalog includes schooling, flee, hunt and apex behavior classes', () => {
  const population = makeWildlifePopulation(() => ({ x: 0, y: 0, z: 0 }), (() => { let i = 0; return () => `w${++i}`; })());
  const behaviors = new Set(population.map(wildlifeBehaviorFor));
  assert.deepEqual([...behaviors].sort(), ['apex', 'flee', 'hunt', 'school']);
});

test('one AI step mutates no more than the fixed actor work budget', () => {
  const population = makeWildlifePopulation(() => ({ x: 0, y: 0, z: 0 }), (() => { let i = 0; return () => `w${++i}`; })());
  const next = stepWildlife(population, [{ id: 'p', mass: 1, position: { x: 2, y: 0, z: 0 } }], 0.25, bounds, 1000);
  const moved = next.filter((actor, index) => JSON.stringify(actor.position) !== JSON.stringify(population[index].position));
  assert.ok(moved.length > 0 && moved.length <= WILDLIFE_UPDATE_BUDGET);
});

test('apex actors transition from wander to stalk/chase using server proximity', () => {
  const actor = { id: 'boss', mass: 6.2, behavior: 'apex', aiState: 'wander', position: { x: 0, y: -24, z: 0 }, heading: { x: 1, y: 0, z: 0 }, seed: 7 };
  const next = stepWildlife([actor], [{ id: 'p', mass: 1, position: { x: 5, y: -24, z: 0 } }], 0.25, bounds, 1000)[0];
  assert.ok(['stalk', 'chase'].includes(next.aiState));
});
```

- [ ] **Step 2: Run the AI tests and verify RED**

Run: `node --test tests/wildlife-state-machine.test.mjs`

Expected: FAIL on missing behavior/budget/state exports.

- [ ] **Step 3: Add deterministic behavior classes without increasing population**

Keep the existing 12 mass tiers repeated twice. Map masses to behavior:

```js
export const WILDLIFE_UPDATE_BUDGET = 8;

export function wildlifeBehaviorFor(actor = {}) {
  const mass = Math.max(0.2, Number(actor.mass) || 1);
  if (mass >= 4.6) return 'apex';
  if (mass >= 1.5) return 'hunt';
  if (mass >= 0.9) return 'flee';
  return 'school';
}
```

Population creation stores `behavior`, `aiState: 'wander'`, and current `biome`. Existing names/masses remain unchanged so starter prey/predator balance is preserved.

- [ ] **Step 4: Replace all-player scans with one player spatial bucket map per AI step**

At the start of `stepWildlife()`:

```js
const playerBuckets = buildSpatialBuckets(Array.isArray(players) ? players : [], 24);
const start = population.length ? Math.abs(Math.floor(now / WILDLIFE_STEP_MS)) % population.length : 0;
const updateIds = new Set(Array.from({ length: Math.min(WILDLIFE_UPDATE_BUDGET, population.length) }, (_, offset) => population[(start + offset) % population.length]?.id));
```

For each actor outside `updateIds`, return it unchanged except for canonical bounded metadata. For updated actors, call `nearbyFromBuckets(playerBuckets, actor.position, 24)` before target selection.

Apex state rules are deterministic:
- prey within 9 units -> `chase`;
- prey within 24 units -> `stalk`;
- otherwise -> `wander`.

School/flee/hunt retain the current movement intent but store `aiState` (`school`, `flee`, `hunt`, `wander`) for snapshots/tests.

- [ ] **Step 5: Expose bounded AI metadata only**

Update `publicWildlife()` in `src/worker.template.mjs` to include:

```js
behavior: actor.behavior,
aiState: actor.aiState,
biome: actor.biome,
```

Do not expose seeds, rate state, internal targets or server timing fields.

- [ ] **Step 6: Run targeted + regression tests and commit Task 2**

Run:

```bash
node --test tests/wildlife-state-machine.test.mjs
node --test tests/spatial-grid.test.mjs
npm test
npm run build
node --check dist/worker.mjs
git diff --check
```

Expected: all PASS.

Commit:

```bash
git add src/wildlife.mjs tests/wildlife-state-machine.test.mjs src/worker.template.mjs
git commit -m "feat: bound wildlife AI state updates"
```

---

### Task 3: Server-authoritative hazards and pickups

**Files:**
- Create: `src/world-actors.mjs`
- Create: `tests/world-actors.test.mjs`
- Modify: `src/game-logic.mjs`
- Modify: `src/progression.mjs`
- Modify: `scripts/build.mjs`
- Modify: `src/worker.template.mjs`

**Interfaces:**
- Consumes: biome helpers, `radiusForMass()`, current server timestamp and player position.
- Produces: `makeWorldActors()`, `resolveHazardContact(player, hazard, now)`, `resolvePickupContact(player, pickup, now)`, `movementMultiplierForPlayer(player, now)`, additive player fields `slowUntil`, `speedBoostUntil`, `bonusPearls`.

- [ ] **Step 1: Write failing hazard/pickup tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as actors from '../src/world-actors.mjs';
import { movementMultiplierForPlayer } from '../src/game-logic.mjs';
import { rewardForSession } from '../src/progression.mjs';

const player = { id: 'p', mass: 1, score: 0, bonusPearls: 0, position: { x: 0, y: -20, z: 0 } };

test('jelly hazard applies a bounded timestamp slow without client authority', () => {
  const hit = actors.resolveHazardContact(player, { id: 'h', type: 'jelly', radius: 1.4, position: { x: 0, y: -20, z: 0 } }, 1000);
  assert.equal(hit.hit, true);
  assert.equal(hit.player.slowUntil, 3000);
  assert.equal(movementMultiplierForPlayer(hit.player, 1500), 0.65);
  assert.equal(movementMultiplierForPlayer(hit.player, 3001), 1);
});

test('current pickup gives bounded temporary speed and is consumed once', () => {
  const hit = actors.resolvePickupContact(player, { id: 'u', type: 'current', radius: 1.2, position: { x: 0, y: -20, z: 0 } }, 1000);
  assert.equal(hit.consumed, true);
  assert.equal(hit.player.speedBoostUntil, 5000);
  assert.equal(movementMultiplierForPlayer(hit.player, 1500), 1.2);
});

test('pearl pickup contributes only a server-derived bounded reward bonus', () => {
  const hit = actors.resolvePickupContact(player, { id: 'u', type: 'pearl', value: 3, radius: 1.2, position: { x: 0, y: -20, z: 0 } }, 1000);
  assert.equal(hit.player.bonusPearls, 3);
  assert.equal(rewardForSession({ score: 0, mass: 1, bonusPearls: hit.player.bonusPearls }).pearls, 3);
});
```

- [ ] **Step 2: Run actor tests and verify RED**

Run: `node --test tests/world-actors.test.mjs`

Expected: FAIL because world actor functions and movement modifier do not exist.

- [ ] **Step 3: Implement fixed world actor budgets**

Use constants:

```js
export const HAZARD_COUNT = 8;
export const PICKUP_COUNT = 12;
export const HAZARD_SLOW_MS = 2000;
export const PICKUP_SPEED_MS = 4000;
```

`makeWorldActors(bounds, idFactory, random)` creates exactly eight jelly hazards and twelve pickups. Pickups alternate `current` and `pearl`; deeper biome profiles weight respawn placement but never change count.

Collision resolution uses a bounded distance check against `radiusForMass(player.mass) + actor.radius`. Jelly does not directly modify mass or score. A pearl pickup increments `bonusPearls` by an integer `1..5`, capped at `100` per room life. A current pickup sets `speedBoostUntil = max(existing, now + 4000)`.

- [ ] **Step 4: Make movement modifiers server-owned and timestamp bounded**

In `src/game-logic.mjs`:

```js
export function movementMultiplierForPlayer(player = {}, now = 0) {
  const timestamp = Number.isFinite(now) ? now : 0;
  const slowed = Number.isFinite(player.slowUntil) && player.slowUntil > timestamp;
  const boosted = Number.isFinite(player.speedBoostUntil) && player.speedBoostUntil > timestamp;
  if (slowed) return 0.65;
  if (boosted) return 1.2;
  return 1;
}
```

Extend `advancePlayer(player, dir, dt, bounds, now = 0)` so only the server's computed base speed is multiplied by `movementMultiplierForPlayer(player, now)`. Keep direction clamping and world bounds unchanged.

- [ ] **Step 5: Include bonus pearls in bounded end-of-life settlement**

In `rewardForSession(summary)` add:

```js
const bonusPearls = Math.min(100, Math.floor(nonNegativeFinite(summary?.bonusPearls)));
const pearls = Math.min(500, Math.floor(score / 5 + massGain * 2) + bonusPearls);
```

Pass `player.bonusPearls` from `GameRoom.settleDeath()`. Respawn resets `bonusPearls`, `slowUntil`, and `speedBoostUntil` to zero so effects cannot leak into the next life.

- [ ] **Step 6: Embed `world-actors.mjs` into the Worker build**

Add a `/*__WORLD_ACTORS__*/` marker after game/world helpers and before GameRoom implementation, then mirror the existing `stripModuleSyntax()` + `replaceRequired()` pattern in `scripts/build.mjs`.

- [ ] **Step 7: Run tests/build and commit Task 3**

Run:

```bash
node --test tests/world-actors.test.mjs
node --test tests/game-logic.test.mjs tests/progression.test.mjs
npm test
npm run build
node --check dist/worker.mjs
git diff --check
```

Expected: all PASS.

Commit:

```bash
git add src/world-actors.mjs tests/world-actors.test.mjs src/game-logic.mjs src/progression.mjs scripts/build.mjs src/worker.template.mjs
git commit -m "feat: add bounded ocean hazards and pickups"
```

---

### Task 4: GameRoom biome/world integration

**Files:**
- Modify: `src/worker.template.mjs`
- Create: `tests/world-worker-integration.test.mjs`

**Interfaces:**
- Consumes: Tasks 1-3 pure helpers.
- Produces: additive snapshot arrays `hazards`, `pickups`; public player `biome`; health metadata `hazardsPerRoom`, `pickupsPerRoom`; bounded actor respawn on consumption.

- [ ] **Step 1: Write failing Worker integration contract**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('src/worker.template.mjs', 'utf8');

test('GameRoom owns biome, hazards and pickups without a perpetual timer', () => {
  for (const marker of [
    'this.worldActors = makeWorldActors(',
    'biome: player.biome',
    'hazards: this.worldActors.hazards',
    'pickups: this.worldActors.pickups',
    'resolveHazardContact(',
    'resolvePickupContact(',
    'biomeForPosition(player.position, WORLD_BOUNDS)',
  ]) assert.ok(worker.includes(marker), `missing world integration: ${marker}`);
  assert.equal(worker.includes('setInterval('), false);
});
```

- [ ] **Step 2: Run Worker integration test and verify RED**

Run: `node --test tests/world-worker-integration.test.mjs`

Expected: FAIL on missing GameRoom world markers.

- [ ] **Step 3: Initialize fixed world actor state in the GameRoom constructor**

Add:

```js
this.worldActors = makeWorldActors(WORLD_BOUNDS, () => crypto.randomUUID().slice(0, 12), Math.random);
this.worldDirty = true;
```

Player creation initializes `biome`, `slowUntil: 0`, `speedBoostUntil: 0`, `bonusPearls: 0`. Reconnect slots preserve active bounded effects by absolute timestamp; expiry is naturally checked on next movement.

- [ ] **Step 4: Advance biome/AI/world only from gameplay work**

Inside input processing after `advancePlayer()`:

```js
player.biome = biomeForPosition(player.position, WORLD_BOUNDS);
```

Keep AI stepping behind the existing `WILDLIFE_STEP_MS` condition. Do not add an alarm/timer for decorative motion.

Resolve hazards/pickups against the active player using their fixed small arrays. On pickup consumption, respawn only that pickup into a server-chosen biome position and set `worldDirty = true`. Hazard state is static except for deterministic respawn/setup, so hazard contact never creates unbounded work.

- [ ] **Step 5: Extend snapshots additively and coalesce world data**

Welcome/full snapshots include:

```js
hazards: this.worldActors.hazards.map(publicWorldActor),
pickups: this.worldActors.pickups.map(publicWorldActor),
```

Delta snapshots include those arrays only when `worldDirty` is true, matching food/wildlife dirty semantics. Client protocol remains v2 because older clients ignore unknown snapshot fields.

- [ ] **Step 6: Extend health evidence without exposing internal state**

`/health` adds fixed numeric fields:

```js
biomes: 4,
hazardsPerRoom: HAZARD_COUNT,
pickupsPerRoom: PICKUP_COUNT,
```

Do not expose player profile ids, session tokens, AI seeds or actor internal timers.

- [ ] **Step 7: Run Worker + full gate and commit Task 4**

Run:

```bash
node --test tests/world-worker-integration.test.mjs
npm test
npm run build
node --check dist/worker.mjs
git diff --check
```

Expected: all PASS.

Commit:

```bash
git add src/worker.template.mjs tests/world-worker-integration.test.mjs
git commit -m "feat: integrate authoritative biome world state"
```

---

### Task 5: Client biome, hazard and pickup presentation

**Files:**
- Create: `public/game/biomes.js`
- Create: `public/game/world-actors.js`
- Modify: `public/game/environment.js`
- Modify: `public/game/state.js`
- Modify: `public/app.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/sw.js`
- Create: `tests/client-world-presentation.test.mjs`

**Interfaces:**
- Consumes: additive server snapshot fields `player.biome`, `hazards`, `pickups`.
- Produces: `biomeVisual(id)`, `createHazardMesh()`, `createPickupMesh()`, biome HUD label and client-only environment transition.

- [ ] **Step 1: Write failing presentation tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as biomes from '../public/game/biomes.js';

test('client biome palette has four canonical presentation-only ids', () => {
  assert.deepEqual(biomes.BIOME_VISUAL_IDS, ['surface', 'reef', 'deep', 'abyss']);
  assert.equal(biomes.biomeVisual('missing').id, 'reef');
});

test('client preserves world arrays across player-only delta snapshots', () => {
  const state = readFileSync('public/game/state.js', 'utf8');
  assert.ok(state.includes('nextHazards'));
  assert.ok(state.includes('nextPickups'));
});

test('HUD and shell expose current biome and cache world presentation modules', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const app = readFileSync('public/app.js', 'utf8');
  const sw = readFileSync('public/sw.js', 'utf8');
  assert.ok(html.includes('id="hud-biome"'));
  assert.ok(app.includes('createHazardMesh'));
  assert.ok(app.includes('createPickupMesh'));
  assert.ok(sw.includes("'/game/biomes.js'"));
  assert.ok(sw.includes("'/game/world-actors.js'"));
});
```

- [ ] **Step 2: Run client world tests and verify RED**

Run: `node --test tests/client-world-presentation.test.mjs`

Expected: FAIL on missing modules/markers.

- [ ] **Step 3: Add presentation-only biome palette**

`public/game/biomes.js` exports four ids and visual parameters only:

```js
export const BIOME_VISUAL_IDS = Object.freeze(['surface', 'reef', 'deep', 'abyss']);
const VISUALS = Object.freeze({
  surface: Object.freeze({ id: 'surface', label: 'Surface', fogScale: 0.72, ambientScale: 1.08 }),
  reef: Object.freeze({ id: 'reef', label: 'Reef', fogScale: 0.9, ambientScale: 1 }),
  deep: Object.freeze({ id: 'deep', label: 'Deep Ocean', fogScale: 1.22, ambientScale: 0.78 }),
  abyss: Object.freeze({ id: 'abyss', label: 'Abyss', fogScale: 1.55, ambientScale: 0.56 }),
});
export function biomeVisual(id) { return VISUALS[id] || VISUALS.reef; }
```

No collision radius, speed, reward or authoritative values exist in this module.

- [ ] **Step 4: Preserve additive world arrays in client state**

Initialize snapshot with `hazards: []`, `pickups: []`. In `applySnapshot()` use existing delta-preservation pattern:

```js
const nextHazards = Array.isArray(next.hazards) ? next.hazards : snapshot.hazards;
const nextPickups = Array.isArray(next.pickups) ? next.pickups : snapshot.pickups;
snapshot = { ...next, food: nextFood, wildlife: nextWildlife, hazards: nextHazards, pickups: nextPickups };
```

- [ ] **Step 5: Render lightweight pooled world actor meshes**

`public/game/world-actors.js` creates procedural, disposable meshes:
- jelly hazard: translucent sphere + tendrils, fixed visual scale from server `radius` only;
- current pickup: torus/ring visual;
- pearl pickup: small emissive clustered spheres.

The module exports `createHazardMesh(theme)`, `applyHazardSnapshot(mesh, actor)`, `createPickupMesh(theme)`, `applyPickupSnapshot(mesh, actor)`, and `disposeWorldActorMesh(mesh)`.

`public/app.js` keeps `hazardMeshes` / `pickupMeshes` maps exactly like food/wildlife maps: reuse by actor id, remove/dispose departed actors, and never perform gameplay collision locally.

- [ ] **Step 6: Add biome HUD and environment transition**

Add one compact HUD row/label:

```html
<p class="room-line">Current <strong id="hud-room">ocean-1</strong> ? <span id="hud-biome">Reef</span></p>
```

`createOceanEnvironment()` gains `applyBiome(id)` that only adjusts fog/decor/particle presentation through `biomeVisual(id)` and does not mutate the theme registry or scene collision state. Call it when the local player's authoritative `biome` changes.

- [ ] **Step 7: Cache new shell modules and advance cache version once**

Add:

```js
'/game/biomes.js',
'/game/world-actors.js',
```

and increment the service-worker shell cache by one version. Do not edit production deploy workflow; it now derives the expected cache marker dynamically.

- [ ] **Step 8: Run client + visual + full gate and commit Task 5**

Run:

```bash
node --test tests/client-world-presentation.test.mjs tests/visual-assets.test.mjs
npm test
npm run build
node --check dist/worker.mjs
git diff --check
```

Expected: all PASS.

Commit:

```bash
git add public/game/biomes.js public/game/world-actors.js public/game/environment.js public/game/state.js public/app.js public/index.html public/styles.css public/sw.js tests/client-world-presentation.test.mjs
git commit -m "feat: present biome world hazards and pickups"
```

---

### Task 6: Carrier 4 qualification and merge gate

**Files:**
- Modify only if evidence requires it: `README.md`
- Modify: `docs/superpowers/plans/2026-09-09-v1-carrier-4-world-ai.md` checkbox state only after corresponding evidence exists.

**Interfaces:**
- Consumes: Tasks 1-5 merged branch state.
- Produces: CI-ready Carrier 4 PR with no production-live claim while Cloudflare credentials are absent.

- [ ] **Step 1: Run the complete deterministic gate from a clean worktree**

Run:

```bash
npm test
npm run build
node --check dist/worker.mjs
git diff --check
git status --short
```

Expected: all tests PASS, build and syntax PASS, diff-check PASS, and status clean after committed changes.

- [ ] **Step 2: Verify invariants with source guards**

Run:

```bash
git grep -n "setInterval(" -- src
node -e "const p=require('./package.json'); if (p.engines.node !== '>=22') process.exit(1)"
```

Expected: no new server-side perpetual timer; Node floor remains 22.

Also verify the new client biome module contains none of `speed`, `radius`, `mass`, `reward`, and the client never sends biome/hazard/pickup outcomes over WebSocket.

- [ ] **Step 3: Push branch and require exact-head GitHub CI**

Create a non-draft PR from `feat/v1-carrier4-world-ai` to `main`. If `main` advanced, reconcile by capability and rerun the complete gate before merge.

Merge only when exact-head CI is green. Use an expected-head SHA guard; never bypass checks or force merge.

- [ ] **Step 4: Record production qualification honestly**

Because the current Cloudflare credential gate is unresolved, Carrier 4 completion means **merged and CI-qualified**, not **production-live-qualified**. Do not manually bypass `.github/workflows/deploy-production.yml`; Carrier 7 resumes production deployment only with valid credentials and the free-plan proof succeeding before mutation.
