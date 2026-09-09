# Abyssal Asset Second Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the approved Abyssal Bioluminescence art direction with six ocean biome presentations, deterministic fish skin families, and production SVG brand/HUD assets without changing authoritative gameplay or the multiplayer protocol.

**Architecture:** Keep the existing client-only presentation architecture. Biomes extend the current theme registry and procedural environment; fish skins live in a pure deterministic module consumed by `fish.js`; brand/HUD visuals are same-origin SVG assets referenced by existing HTML/CSS and included in the PWA shell. No new runtime asset loader, paid service, protocol field, or server state is introduced.

**Tech Stack:** JavaScript ES modules, Three.js 0.185.1, Node 22 built-in test runner, HTML/CSS/SVG, existing Cloudflare Worker static-asset build.

**Spec:** `docs/superpowers/specs/2026-09-09-abyssal-asset-system-design.md`

## Global Constraints

- Browser-first, compatible with the existing Three.js client.
- Do not require paid external asset services or paid runtime dependencies.
- No asset change may make game startup dependent on an optional model or texture.
- Current multiplayer protocol and authoritative gameplay logic are out of scope.
- Existing movement and camera behavior must remain unchanged.
- Shared geometry/material patterns should be reused rather than duplicated per player.
- Repeated environment objects should use instancing where practical.
- Effects and decoration must degrade gracefully under lower graphics profiles.
- New same-origin assets required by the shell must be included in the service-worker precache.

---

### Task 1: Six-biome presentation pack

**Files:**
- Modify: `public/game/themes.js`
- Modify: `public/game/environment.js`
- Modify: `public/index.html`
- Test: `tests/theme.test.mjs`
- Test: `tests/visual-assets.test.mjs`

**Interfaces:**
- Existing `getTheme(id)`, `themeIds()`, and `applyDocumentTheme(themeOrId)` remain stable.
- Preserve legacy IDs `stylized` and `deep-sea` so saved settings continue to load.
- Add four IDs: `twilight-garden`, `blue-trench`, `volcanic-rift`, `leviathan-depths`.
- Interpret `stylized` as the Sunken Reef presentation and `deep-sea` as the Ancient Abyss presentation while keeping their IDs unchanged.
- Every theme must expose `scene`, `lighting`, `floor`, `water`, `decor`, `food`, `fish`, `atmosphere`, and `css`.
- Add `decor.accent` and `decor.accentAlt` for biome-specific secondary props.

- [ ] **Step 1: Write failing theme-catalog tests**

Add assertions equivalent to:

```js
assert.deepEqual(themeIds(), [
  'stylized',
  'deep-sea',
  'twilight-garden',
  'blue-trench',
  'volcanic-rift',
  'leviathan-depths',
]);
for (const id of themeIds()) {
  const theme = getTheme(id);
  assert.equal(typeof theme.decor.accent, 'number');
  assert.equal(typeof theme.decor.accentAlt, 'number');
}
```

Add a source-level visual test that requires `environment.js` to create and instance at least two secondary biome prop families using shared geometry/materials rather than one mesh per prop.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test tests/theme.test.mjs tests/visual-assets.test.mjs
```

Expected: FAIL because the four new biome IDs and accent prop contracts do not exist.

- [ ] **Step 3: Implement the four additional theme records**

Add immutable theme objects with these art targets:

```text
stylized / Sunken Reef      = turquoise + coral pink + amber, brighter caustic shafts
winter?                     = never add; not in approved Art Bible
Twilight Garden             = blue/violet + giant-kelp accent + jelly glow
Blue Trench                 = dark cyan + slate rock + sparse cold biolume
Volcanic Rift               = near-black basalt + ember/orange vent accents
Deep Sea / Ancient Abyss    = muted teal + bone/ruin accents
Leviathan Depths            = near-black + cyan/violet creature-driven light
```

Keep all numeric theme values finite and bounded to the same ranges used by the existing theme records.

- [ ] **Step 4: Add reusable biome accent props**

In `environment.js`, create shared geometry/material pairs at module or environment scope and instance them through the existing `createInstancedDecor` helper. Use simple procedural forms that read as:

```text
accent     = tube sponge / vent / ruin shard depending on theme color
accentAlt  = fan coral / crystal / bone fragment depending on theme color
```

The geometry stays constant; the active theme changes colors/emissive strength. Counts derive from existing `profile.coral`/`profile.rocks` values so graphics quality remains the only density control.

- [ ] **Step 5: Extend both Ocean style selectors**

Add options to `#theme-select` and `#settings-theme-select` for the four new IDs. Keep `stylized` and `deep-sea` option values unchanged.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
node --test tests/theme.test.mjs tests/visual-assets.test.mjs
npm test
npm run build
node --check dist/worker.mjs
```

- [ ] **Step 7: Commit**

Commit message:

```text
feat: add six-biome ocean presentation pack
```

---

### Task 2: Deterministic fish skin families

**Files:**
- Create: `public/game/fish-skins.mjs`
- Modify: `public/game/fish.js`
- Modify: `public/sw.js`
- Test: `tests/visual-assets.test.mjs`
- Test: `tests/public-alpha-delivery.test.mjs`

**Interfaces:**
- Produce `SKIN_FAMILIES`, `skinFamilyForId(id)`, and `skinPaletteFor(id, theme)`.
- Skin selection must be deterministic from the existing fish/player id; no new WebSocket payload or server field.
- Initial families: `azure`, `coral`, `toxic`, `ember`, `aurora`, `void`, `royal`, `pearl`, `tiger`, `koi`, `spectral`, `leviathan`.
- `skinPaletteFor` returns a frozen/plain object with `body`, `fin`, `accent`, and `emissive` numeric hex colors plus bounded `roughnessOffset` and `metalnessOffset`.
- Existing exports from `fish.js` remain stable.

- [ ] **Step 1: Write failing pure-module tests**

Add tests equivalent to:

```js
assert.equal(SKIN_FAMILIES.length, 12);
assert.equal(new Set(SKIN_FAMILIES.map((skin) => skin.id)).size, 12);
assert.equal(skinFamilyForId('player-42'), skinFamilyForId('player-42'));
assert.notEqual(skinFamilyForId('player-42'), undefined);
const palette = skinPaletteFor('player-42', getTheme('stylized'));
for (const key of ['body', 'fin', 'accent', 'emissive']) {
  assert.equal(Number.isInteger(palette[key]), true);
}
```

Add a wiring test requiring `fish.js` to import and consume `skinPaletteFor` for remote fish while retaining the local-player cyan recognition accents.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test tests/visual-assets.test.mjs
```

Expected: FAIL because `public/game/fish-skins.mjs` does not exist.

- [ ] **Step 3: Implement the deterministic skin module**

Use a stable string hash and modulo 12 selection. Define each family as reusable palette relationships, not separate geometry. Build returned colors by blending family HSL targets with the active theme so skins remain readable in all six biomes.

Do not import Three.js in this module; keep it Node-testable.

- [ ] **Step 4: Apply skin palettes in `fish.js`**

Replace the remote-fish single `idHue` body color path with `skinPaletteFor(id, theme)`. Apply body and fin colors separately and use the palette accent/emissive for restrained material variation. Local-player body may still use the deterministic family, but the existing localized cyan bioluminescence remains the strongest recognition cue.

Store `skinFamilyId` on `rig.userData` for debugging/readability. Do not create extra per-frame materials.

- [ ] **Step 5: Keep offline support complete**

Add `/game/fish-skins.mjs` to `public/sw.js` and bump the shell cache version exactly once for this phase. Extend the offline-shell regression test to require both evolution and skin modules.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
node --test tests/visual-assets.test.mjs tests/public-alpha-delivery.test.mjs
npm test
npm run build
node --check dist/worker.mjs
```

- [ ] **Step 7: Commit**

Commit message:

```text
feat: add deterministic Abyssal fish skins
```

---

### Task 3: Brand mark and HUD SVG asset pack

**Files:**
- Create: `public/assets/brand/abyss-eater-mark.svg`
- Create: `public/assets/ui/icons/mass.svg`
- Create: `public/assets/ui/icons/crown.svg`
- Create: `public/assets/ui/icons/skull.svg`
- Create: `public/assets/ui/icons/jaw.svg`
- Create: `public/assets/ui/icons/evolution.svg`
- Create: `public/assets/ui/icons/depth.svg`
- Create: `public/assets/ui/icons/settings.svg`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/sw.js`
- Test: `tests/visual-assets.test.mjs`
- Test: `tests/public-alpha-delivery.test.mjs`

**Interfaces:**
- SVGs are same-origin static assets with `viewBox="0 0 24 24"` for HUD icons and a square viewBox for the brand mark.
- All SVGs must use `currentColor` or a tiny approved cyan/aqua palette; no external font/image references, scripts, filters requiring network resources, or embedded raster images.
- Existing HUD element IDs used by `hud.js` must not change.
- Existing settings button ID and accessibility label remain stable.

- [ ] **Step 1: Write failing asset-presence and wiring tests**

Test exact paths with `existsSync` and require `index.html` to reference the new brand mark and HUD icons. Require `styles.css` to include `.metric-icon`, `.hud-brand-mark`, and icon sizing rules without changing existing HUD IDs.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test tests/visual-assets.test.mjs tests/public-alpha-delivery.test.mjs
```

Expected: FAIL because the SVG files and markup references do not exist.

- [ ] **Step 3: Create the brand mark**

Create an original Abyss Eater symbol: a compact predatory fish/jaw silhouette orbiting a small bioluminescent core. Keep it readable at 24–64 px and avoid detailed wordmark text inside the SVG.

- [ ] **Step 4: Create the HUD icon family**

Create simple stroke/fill SVGs with consistent optical weight for mass, leaderboard crown, death/skull, eat/jaw, evolution, depth, and settings. Keep each file small and dependency-free.

- [ ] **Step 5: Wire assets into existing markup**

Use `<img>` elements with empty `alt` where text already labels the metric, so visual icons remain decorative and accessible. Add the brand mark to loading, lobby lockup, and HUD logo areas. Replace the Unicode settings glyph with the SVG while retaining `aria-label="Game settings"`.

Do not rename `#hud-mass`, `#hud-score`, `#hud-rank`, `#hud-players`, `#hud-ping`, `#growth-progress`, `#depth-meter`, or `#settings-button`.

- [ ] **Step 6: Style the visual system**

Add compact icon containers, subtle currentColor glow, and spacing that works at current desktop/mobile breakpoints. Do not expand HUD cards enough to occlude more gameplay area than the current layout.

- [ ] **Step 7: Precache required SVG assets**

Add all eight SVG paths to `public/sw.js`. Bump the shell cache version once if Task 2 has not already done so; if Task 2 already bumped it in this same phase, reuse that new version and only extend `SHELL`.

- [ ] **Step 8: Verify GREEN**

Run:

```bash
node --test tests/visual-assets.test.mjs tests/public-alpha-delivery.test.mjs
npm test
npm run build
node --check dist/worker.mjs
```

- [ ] **Step 9: Commit**

Commit message:

```text
feat: add Abyss Eater brand and HUD icon assets
```

---

### Task 4: Final second-slice audit

**Files:**
- No production changes unless verification exposes a defect.

- [ ] **Step 1: Inspect PR changed filenames**

Confirm no files under `src/`, `gateway/`, `wrangler*`, or deployment workflows changed in this phase.

- [ ] **Step 2: Verify full CI on final head**

Require the repository `test-and-build` workflow to pass on the final branch head with tests, Worker build, and syntax check all successful.

- [ ] **Step 3: Verify offline asset closure**

Confirm every new ES module imported by the shell and every new SVG referenced by startup/HUD markup appears in `public/sw.js`.

- [ ] **Step 4: Verify GPU lifecycle**

Confirm biome decorations reuse instanced shared geometries/materials, fish skin work does not create materials per frame, and existing `disposeFishRig` / environment `dispose` paths remain sufficient.

- [ ] **Step 5: Keep PR #16 unmerged until visual review or explicit merge instruction**

This phase extends the visual trial on the existing PR. Do not merge into `main` solely because CI is green.
