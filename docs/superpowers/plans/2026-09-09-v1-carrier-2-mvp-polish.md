# Abyss Eater V1 Carrier 2 MVP Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hardened multiplayer client into a production-oriented responsive browser/PWA shell with explicit loading, unsupported-browser, reconnect and respawn states, accessible settings, quality/reduced-effects controls, lightweight audio, and cacheable pinned assets while preserving Carrier 1 protocol authority.

**Architecture:** Keep `public/app.js` as the Three.js gameplay client, but move non-gameplay concerns into small dependency-free modules served by the existing embedded Worker asset map. Add a lightweight `public/bootstrap.js` that performs capability checks, service-worker registration and dynamic loading before the Three.js client starts. Client settings and audio remain local-only presentation state; no setting may alter authoritative movement, collision, mass, score, reconnect semantics or protocol messages.

**Tech Stack:** Browser ES modules, Three.js 0.185.1, Web Audio API, Service Worker Cache API, Node.js 22 built-in test runner, dependency-free Worker assembler, Cloudflare Workers/Durable Objects.

**Spec:** `docs/superpowers/specs/2026-09-09-abyss-eater-v1-full-abc-design.md`

## Global Constraints

- Preserve protocol `v=1`, strict monotonic input sequencing, 25-message/1000ms flood guard, deterministic spatial collision and 12-second reconnect behavior from Carrier 1.
- Server remains authoritative for position, movement speed, world bounds, collision/eating, food, mass, score and respawn.
- Do not add a perpetual timer to a Durable Object.
- Do not enable paid Cloudflare products or introduce a paid external dependency.
- Node 22 CI remains secret-free.
- Realtime gameplay always requires network; the PWA cache is application-shell/static-asset only.
- Three.js stays pinned to exactly `0.185.1` in Carrier 2.
- Accessibility controls must not interfere with pointer-lock gameplay once the game canvas owns focus.

---

### Task 1: Capability bootstrap and explicit loading/unsupported states

**Files:**
- Create: `public/bootstrap.js`
- Create: `src/client-capabilities.mjs`
- Create: `tests/client-capabilities.test.mjs`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `scripts/build.mjs`
- Modify: `tests/build.test.mjs`

**Interfaces:**
- Produces `classifyCapabilities({ webgl, modules, serviceWorker }) -> { playable, reason, serviceWorker }`.
- `public/bootstrap.js` checks WebGL before importing `/app.js`.
- Bootstrap sets `document.documentElement.dataset.appState` to `loading`, `ready`, or `unsupported`.
- Unsupported state uses a visible `#unsupported-screen` with bounded user-facing copy and no raw exception text.
- Bootstrap registers `/service-worker.js` only when supported and only after the page becomes usable.

- [ ] **Step 1: Add RED capability tests**

Create `tests/client-capabilities.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCapabilities } from '../src/client-capabilities.mjs';

test('capability classification fails closed without WebGL', () => {
  assert.deepEqual(classifyCapabilities({ webgl: false, modules: true, serviceWorker: true }), {
    playable: false,
    reason: 'webgl_unavailable',
    serviceWorker: true,
  });
});

test('service worker support is optional for gameplay', () => {
  assert.deepEqual(classifyCapabilities({ webgl: true, modules: true, serviceWorker: false }), {
    playable: true,
    reason: null,
    serviceWorker: false,
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/client-capabilities.test.mjs`

Expected: FAIL because `src/client-capabilities.mjs` does not exist.

- [ ] **Step 3: Implement the pure classifier**

`src/client-capabilities.mjs` must export:

```js
export function classifyCapabilities(input = {}) {
  const serviceWorker = input.serviceWorker === true;
  if (input.modules !== true) return { playable: false, reason: 'modules_unavailable', serviceWorker };
  if (input.webgl !== true) return { playable: false, reason: 'webgl_unavailable', serviceWorker };
  return { playable: true, reason: null, serviceWorker };
}
```

- [ ] **Step 4: Add bootstrap DOM states**

`public/index.html` starts with `data-app-state="loading"`, adds `#loading-screen` and `#unsupported-screen`, and replaces `<script type="module" src="/app.js">` with `<script type="module" src="/bootstrap.js">`.

`public/bootstrap.js` imports `/client-capabilities.mjs`, checks a temporary canvas for `webgl2` or `webgl`, displays the unsupported screen when `playable=false`, otherwise dynamically imports `/app.js` and sets `data-app-state="ready"`. A rejected import sets unsupported reason `client_load_failed` without showing stack traces.

- [ ] **Step 5: Add build routes and static assertions**

Add `/bootstrap.js` and `/client-capabilities.mjs` to `assetFiles` in `scripts/build.mjs`. Extend `tests/build.test.mjs` to require `data-app-state`, `id=\"loading-screen\"`, `id=\"unsupported-screen\"`, `"/bootstrap.js":` and `"/client-capabilities.mjs":` in the built Worker.

- [ ] **Step 6: Verify GREEN**

Run: `node --test tests/client-capabilities.test.mjs tests/build.test.mjs && npm test && npm run build && node --check dist/worker.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add public/bootstrap.js src/client-capabilities.mjs tests/client-capabilities.test.mjs public/index.html public/styles.css scripts/build.mjs tests/build.test.mjs
git commit -m "feat: add capability-aware game bootstrap"
```

### Task 2: Settings, quality presets and reduced-effects policy

**Files:**
- Create: `src/client-settings.mjs`
- Create: `tests/client-settings.test.mjs`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`
- Modify: `scripts/build.mjs`
- Modify: `tests/build.test.mjs`

**Interfaces:**
- Produces `DEFAULT_SETTINGS` with `{ quality:'auto', reducedEffects:false, master:0.65, music:0.35, sfx:0.75 }`.
- Produces `normalizeSettings(value)` returning a complete bounded settings object.
- Produces `resolveQualityPreset(settings, environment)` returning `{ pixelRatioCap, bubbles, shadows, decorativeDistance }`.
- Allowed quality values are exactly `auto | low | medium | high`.
- `master`, `music`, `sfx` are clamped to `[0,1]`.
- App stores settings under localStorage key `abyss-eater-settings-v1` and survives storage exceptions.

- [ ] **Step 1: Add RED normalization tests**

Require unknown quality to become `auto`, non-finite volume to use defaults, values outside `[0,1]` to clamp, and `reducedEffects` to become boolean only when explicitly true.

```js
assert.deepEqual(normalizeSettings({ quality: 'ultra', master: 4, music: -2, sfx: NaN }), {
  quality: 'auto', reducedEffects: false, master: 1, music: 0, sfx: 0.75,
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/client-settings.test.mjs`

Expected: FAIL on missing module.

- [ ] **Step 3: Implement deterministic presets**

`low`: pixel ratio 1, 90 bubbles, no decorative shadows, decorative distance 45.
`medium`: pixel ratio 1.5, 220 bubbles, no decorative shadows, distance 70.
`high`: pixel ratio 2, 360 bubbles, decorative shadows allowed, distance 100.
`auto`: choose low when `reducedEffects=true` or environment reports coarse pointer / width `<760`; otherwise high when device pixel ratio `<=2` and width `>=1200`, else medium.

- [ ] **Step 4: Add accessible settings dialog**

Add a `Settings` button to the start panel and HUD, plus `<dialog id="settings-dialog">` containing a quality `<select>`, reduced-effects checkbox, three range inputs for master/music/SFX, and a close button. Every input has a `<label for>` association. Dialog opens by button click, closes by button/Escape, and does not request pointer lock while open.

- [ ] **Step 5: Apply quality without changing gameplay**

`public/app.js` imports `/client-settings.mjs`, replaces hard-coded renderer pixel ratio and bubble count with the resolved preset, and reduces decorative animation work when `reducedEffects=true`. It must not alter `currentDirection()`, WebSocket input payloads, world coordinates, fish collision geometry or server data.

- [ ] **Step 6: Add build routing and static regression markers**

Embed `/client-settings.mjs`; require settings dialog ids, all four preset strings, `abyss-eater-settings-v1`, `prefers-reduced-motion`, and the existing protocol markers in build tests.

- [ ] **Step 7: Verify GREEN and commit**

Run: `node --test tests/client-settings.test.mjs tests/build.test.mjs && npm test && npm run build && node --check dist/worker.mjs`

Expected: PASS.

Commit: `feat: add accessible quality and effects settings`.

### Task 3: Lightweight local audio framework

**Files:**
- Create: `src/client-audio.mjs`
- Create: `tests/client-audio.test.mjs`
- Modify: `public/app.js`
- Modify: `scripts/build.mjs`
- Modify: `tests/build.test.mjs`

**Interfaces:**
- Produces `effectiveGain(master, channel) -> number` clamped to `[0,1]`.
- Produces `createAudioController({ getSettings })` with methods `unlock()`, `setSuspended(bool)`, `playUi()`, `playEat()`, `playDeath()`, `startAmbience()`, `stopAmbience()`.
- Uses Web Audio oscillators/gain nodes only; no external audio asset, analytics or paid dependency.
- Audio context is created only after explicit user interaction.
- Background visibility suspends ambience.

- [ ] **Step 1: RED unit tests**

Test `effectiveGain(0.5,0.5) === 0.25`, negative input -> `0`, values over one -> `1`, non-finite -> `0`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/client-audio.test.mjs`.

- [ ] **Step 3: Implement Web Audio controller**

Use a lazily-created `AudioContext`. `playUi`, `playEat` and `playDeath` synthesize short bounded oscillator envelopes. `startAmbience` creates one low-volume looping oscillator pair only after `unlock`; `stopAmbience` disconnects them. No `setInterval` is used for audio.

- [ ] **Step 4: Wire gameplay/UI events**

Unlock on the play/settings interaction. Play UI feedback for settings/open/close, eat feedback when local mass/score increases between authoritative snapshots, and death feedback on `eaten`. `visibilitychange` suspends/resumes ambience only when user settings permit.

- [ ] **Step 5: Build/static tests and GREEN**

Embed `/client-audio.mjs`; assert `AudioContext`, `visibilitychange`, `playDeath`, `playEat`, and no external `.mp3/.ogg/.wav` URL. Run full test/build/syntax suite.

- [ ] **Step 6: Commit**

Commit: `feat: add local bounded ocean audio framework`.

### Task 4: Responsive reconnect/respawn feedback and keyboard-safe menus

**Files:**
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`
- Create: `tests/client-flow.test.mjs`

**Interfaces:**
- UI states use `body.dataset.connectionState` values `ready | connecting | online | reconnecting | upgrade-required | offline`.
- `#connection-banner` communicates reconnect/offline/upgrade state using `role="status"`.
- `#respawn-card` communicates authoritative `eaten`/respawn feedback and is never used to delay server respawn.
- Menu buttons are reachable with Tab and activate with native button semantics.

- [ ] **Step 1: Add RED static-flow tests**

Read `public/index.html`, `public/styles.css` and `public/app.js`; require `connection-banner`, `respawn-card`, all connection-state names, `role="status"`, `aria-live`, `env(safe-area-inset-bottom)`, and a `keydown` guard that ignores gameplay input while the settings dialog is open or focus is in an input/select/button/textarea.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/client-flow.test.mjs`.

- [ ] **Step 3: Implement connection state projection**

Replace status-only copy with one function that updates HUD plus `body.dataset.connectionState`. Online hides the banner. Reconnecting/offline shows actionable copy. Protocol mismatch shows permanent `Upgrade required` state and preserves Carrier 1's `protocolBlocked` behavior.

- [ ] **Step 4: Implement respawn feedback**

On `eaten`, show predator name when provided and briefly display `#respawn-card`. It is presentation only: no client countdown is allowed to gate movement or server messages.

- [ ] **Step 5: Harden keyboard/touch behavior**

Gameplay key handlers return when settings dialog is open or the event target is a form control. Pointer lock is released when settings opens and may be reacquired only after settings closes and the user clicks the canvas. Touch controls keep safe-area padding and minimum 44px targets.

- [ ] **Step 6: GREEN and commit**

Run `node --test tests/client-flow.test.mjs && npm test && npm run build && node --check dist/worker.mjs`.

Commit: `feat: polish reconnect respawn and accessible game states`.

### Task 5: PWA shell cache and manifest hardening

**Files:**
- Create: `public/service-worker.js`
- Create: `public/icon.svg`
- Create: `tests/pwa.test.mjs`
- Modify: `public/manifest.webmanifest`
- Modify: `public/bootstrap.js`
- Modify: `scripts/build.mjs`
- Modify: `tests/build.test.mjs`

**Interfaces:**
- Cache name is `abyss-eater-shell-v2`.
- Local shell list contains `/`, `/bootstrap.js`, `/app.js`, `/client-input.mjs`, `/client-capabilities.mjs`, `/client-settings.mjs`, `/client-audio.mjs`, `/styles.css`, `/manifest.webmanifest`, `/icon.svg`.
- The pinned Three.js URL is exactly `https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js`.
- `/ws` and `/health` are never served cache-first.
- Navigation uses network-first with cached `/` fallback; immutable shell/static requests use cache-first with network fill.

- [ ] **Step 1: Add RED PWA tests**

Parse manifest JSON and assert `id:'/'`, `start_url:'/'`, `scope:'/'`, `display:'standalone'`, and at least one SVG icon with purpose `any maskable`. Read service worker source and require the cache name, pinned Three URL, `/ws` bypass and navigation fallback.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/pwa.test.mjs`.

- [ ] **Step 3: Implement service worker**

On install, cache the bounded shell list plus pinned Three module. On activate, remove old cache names beginning with `abyss-eater-shell-` except v2. In fetch, pass through non-GET and realtime/API routes; navigation is network-first with `/` fallback; known static shell paths are cache-first.

- [ ] **Step 4: Harden manifest/icon and registration**

Add `id`, icons, `prefer_related_applications:false`, categories and shortcuts without making install mandatory. Bootstrap registers the root-scoped worker after the app reaches ready state; registration failure is ignored for gameplay and never exposes raw exceptions.

- [ ] **Step 5: Embed routes and verify GREEN**

Add `/service-worker.js` content type `text/javascript; charset=utf-8` and `/icon.svg` content type `image/svg+xml; charset=utf-8` to the build. Run `node --test tests/pwa.test.mjs tests/build.test.mjs && npm test && npm run build && node --check dist/worker.mjs`.

- [ ] **Step 6: Commit**

Commit: `feat: add offline-capable PWA application shell`.

### Task 6: Production asset/security regression and Carrier 2 release gate

**Files:**
- Create: `tests/carrier2-release.test.mjs`
- Modify: `src/worker.template.mjs`
- Modify: `README.md`
- Create: `docs/runbooks/client-polish.md`

**Interfaces:**
- Security headers continue to deny camera, microphone and geolocation.
- CSP keeps scripts limited to self plus the exact pinned jsDelivr origin required by Three.js; no wildcard script/connect origin is introduced.
- Service-worker script is served with `cache-control: no-cache` so update checks are not trapped behind the normal five-minute static cache.
- `/health` remains version `0.2.0` / protocol `1` during Carrier 2; protocol bump is not justified by presentation-only changes.

- [ ] **Step 1: Add RED release tests**

Require the built Worker to include all Carrier 2 routes, no unversioned `three@latest`, no unpinned `three/build`, no external audio URL, no `script-src *`, and an explicit `no-cache` response policy for `/service-worker.js`.

- [ ] **Step 2: Implement Worker cache override**

Update asset response construction so HTML and `/service-worker.js` use `no-cache`; other embedded local assets may remain `public, max-age=300`. Preserve the existing security headers and protocol behavior.

- [ ] **Step 3: Document operations and rollback**

`docs/runbooks/client-polish.md` records local validation commands, browser checks (desktop pointer lock, keyboard-only menu, mobile safe-area, WebGL-disabled unsupported state, offline reload after one online load), deployment verification of `/health`, and rollback by redeploying the previously verified Worker version. README documents settings/PWA/audio without claiming offline gameplay.

- [ ] **Step 4: Final exact-head qualification**

Run: `npm test && npm run build && node --check dist/worker.mjs`.

Expected: zero failed tests and successful production Worker syntax check.

- [ ] **Step 5: PR/merge gate**

Open a non-draft PR to `main`. Merge only when exact-head GitHub Actions `test-and-build` is green. After merge, require the `main` push run to be green before Carrier 3 starts.

- [ ] **Step 6: Commit**

Commit: `docs: qualify V1 carrier 2 client polish`.
