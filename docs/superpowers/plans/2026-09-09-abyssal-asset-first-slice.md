# Abyssal Asset First Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first lightweight Abyssal Bioluminescence visual slice: deterministic fish evolution silhouettes, localized local-player bioluminescence, marine-themed food, and compact ring VFX without changing gameplay or protocol.

**Architecture:** Add a pure browser/Node-compatible `fish-evolution.mjs` module that owns deterministic mass-to-tier visual data. Keep Three.js rendering in `fish.js`, applying those profiles to shared procedural geometry. Extend the existing effect manager with disposable transient ring pulses and keep all server/network code unchanged.

**Tech Stack:** JavaScript ES modules, Node 22 built-in test runner, Three.js 0.185.1 loaded by the browser client, existing Cloudflare Worker build pipeline.

**Spec:** `docs/superpowers/specs/2026-09-09-abyssal-asset-system-design.md`

## Global Constraints

- Browser-first, compatible with the existing Three.js client.
- Do not require paid external asset services or paid runtime dependencies.
- No asset change may make game startup dependent on an optional model or texture.
- Current multiplayer protocol and authoritative gameplay logic are out of scope.
- Existing movement and camera behavior must remain unchanged.
- Reuse shared geometry; dispose per-rig/per-effect materials and private geometry.
- Graphics effects must degrade under reduced-effects mode.

---

### Task 1: Deterministic evolution visual profiles

**Files:**
- Create: `public/game/fish-evolution.mjs`
- Create: `tests/visual-assets.test.mjs`

**Interfaces:**
- Produces: `EVOLUTION_TIERS`, `evolutionTierForMass(mass)`, `silhouetteForMass(mass)`.
- `evolutionTierForMass` returns one of `fry`, `reefling`, `hunter`, `razorfin`, `abyss-predator`, `leviathan`.
- Thresholds preserve the existing log2 growth semantics: 1, 2, 4, 8, 16, 32+ mass.

- [ ] **Step 1: Write the failing test**

Create tests that import the new module and assert mass boundaries, non-finite/invalid normalization to `fry`, six unique tier ids, and visibly distinct silhouette profile values across tiers.

- [ ] **Step 2: Verify RED**

Run `node --test tests/visual-assets.test.mjs` and confirm it fails because `public/game/fish-evolution.mjs` does not exist.

- [ ] **Step 3: Implement the pure module**

Create immutable tier definitions with body, tail, fin, eye, mouth, and spine-count visual parameters. Keep it free of Three.js imports so Node tests can execute it directly.

- [ ] **Step 4: Verify GREEN**

Run `node --test tests/visual-assets.test.mjs` then `npm test`.

- [ ] **Step 5: Commit**

Commit the deterministic visual profile module and its tests.

---

### Task 2: Apply tier silhouettes and local bioluminescence

**Files:**
- Modify: `public/game/fish.js`
- Modify: `tests/visual-assets.test.mjs`
- Modify: `tests/premium-runtime-regressions.test.mjs`

**Interfaces:**
- Consumes: `silhouetteForMass(mass)` from Task 1.
- Fish rig `userData` tracks the currently applied tier id so geometry transforms update only when the tier changes.
- Existing exports `createFishRig`, `applyFishSnapshot`, `animateFishRig`, `applyFishTheme`, `disposeFishRig` remain stable.

- [ ] **Step 1: Write failing wiring/disposal tests**

Assert `fish.js` imports the evolution module, stores an applied tier, includes localized `gill`/`lateral` bioluminescent elements, and disposes their private materials/geometry where applicable.

- [ ] **Step 2: Verify RED**

Run the focused tests and confirm the missing wiring assertions fail.

- [ ] **Step 3: Implement tier application**

Add reusable procedural snout/spine/accent geometry, store mesh references on the rig, and apply silhouette profile transforms when mass crosses a tier boundary. Keep growth scale interpolation intact so gameplay size remains mass-driven.

- [ ] **Step 4: Implement local bioluminescence**

Add restrained gill and lateral-line emissive accents. Local player gets visible pulsing opacity; remote fish keep the accents hidden. Keep the legacy glow shell only as a very low-opacity fallback.

- [ ] **Step 5: Verify GREEN**

Run focused tests and `npm test`.

- [ ] **Step 6: Commit**

Commit fish rendering changes.

---

### Task 3: Marine-themed procedural food

**Files:**
- Modify: `public/game/fish.js`
- Modify: `tests/visual-assets.test.mjs`

**Interfaces:**
- Existing `createFoodMesh(theme)` and `applyFoodTheme(mesh, theme)` signatures remain unchanged.
- Returned object remains an Object3D with `.position` and `userData.foodMaterial` so `public/app.js` does not require protocol or lifecycle changes.

- [ ] **Step 1: Write failing source-level regression test**

Assert the food renderer uses a grouped marine silhouette and no longer returns the standalone `FOOD_GEOMETRY` polyhedron mesh as the complete food representation.

- [ ] **Step 2: Verify RED**

Run the focused visual test and confirm it fails against the current single-icosahedron food renderer.

- [ ] **Step 3: Implement the food form**

Build a small glowing plankton/lantern-creature group from shared sphere/cone geometry, one per-food material, and lightweight fin/tendril shapes. Do not introduce external textures or runtime model downloads.

- [ ] **Step 4: Verify GREEN**

Run focused tests and `npm test`.

- [ ] **Step 5: Commit**

Commit the food visual upgrade.

---

### Task 4: Growth/eat pulse ring VFX

**Files:**
- Modify: `public/game/effects.js`
- Modify: `tests/visual-assets.test.mjs`

**Interfaces:**
- Existing effect-manager public methods remain unchanged: `food`, `eat`, `growth`, `respawn`, `danger`, `update`, `dispose`.
- New ring effects are internal to `createEffectManager` and are disabled by `reducedMotion`.

- [ ] **Step 1: Write failing VFX lifecycle test**

Assert the effect manager creates a transient ring path for eat/growth, updates opacity/scale over time, and disposes per-ring material on removal.

- [ ] **Step 2: Verify RED**

Run focused visual tests and confirm ring lifecycle assertions fail.

- [ ] **Step 3: Implement pulse rings**

Use one shared ring geometry and per-ring additive transparent material. Add internal `pulseRing`, `removeRing`, update, and disposal handling. Trigger a larger ring from `eat` and a softer ring from `growth`.

- [ ] **Step 4: Verify GREEN**

Run focused tests, `npm test`, `npm run build`, and `node --check dist/worker.mjs`.

- [ ] **Step 5: Commit**

Commit the VFX slice.

---

### Task 5: PR verification

**Files:**
- No production changes unless verification exposes a defect.

- [ ] **Step 1: Inspect the PR diff**

Confirm no server protocol, Durable Object, gameplay balance, movement, or camera files changed unexpectedly.

- [ ] **Step 2: Verify CI**

Require the repository CI test-and-build job to pass on the final head SHA.

- [ ] **Step 3: Review GPU lifecycle**

Confirm newly introduced per-rig and transient per-effect materials are released on the existing disposal paths.

- [ ] **Step 4: Keep the PR unmerged for visual review**

The first slice is a visual trial. Do not merge it into `main` until the user has had a chance to inspect the visual direction or explicitly asks to merge.
