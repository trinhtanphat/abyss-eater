# Abyss Eater Full Game UI/UX Overhaul Design

## Goal
Transform the existing playable Three.js multiplayer prototype into a polished, responsive 3D fish-eat-fish experience without changing the authoritative multiplayer rules. Phase A ships a stylized premium ocean experience as the default presentation. Phase B adds a switchable realistic deep-sea presentation that reuses the same gameplay, networking, controls, HUD data, and performance budgets.

## Scope and sequencing

### Phase A — Stylized Premium Ocean
Phase A is the default visual identity and must be complete before Phase B begins. It includes a new fish character system, animated fins and tails, improved ocean environment, HUD/lobby overhaul, gameplay feedback, leaderboard, depth presentation, pointer/mobile controls, and performance/accessibility settings.

### Phase B — Realistic Deep Sea
Phase B is an additional presentation mode, not a replacement for Phase A. A player can switch between `Stylized` and `Deep Sea` modes from the lobby/settings UI. The deep-sea mode changes lighting, fog, material response, environment density, particles, fish shading, and color grading while preserving the same geometry contracts, game state, networking, and input behavior.

## Non-goals
- Do not change server-authoritative movement, eating, collision, respawn, or score rules unless a strictly presentation-only state field becomes necessary.
- Do not add paid services, paid assets, telemetry vendors, or a paid CDN.
- Do not add a heavy game engine or framework migration.
- Do not require external binary 3D model assets for the first version; fish and environment art should remain procedural or generated from lightweight code/data in the repository.
- Do not merge the feature branch into `main` as part of implementation unless explicitly requested after review.

## Existing architecture
The client currently consists of `public/index.html`, `public/styles.css`, and a monolithic `public/app.js` that owns Three.js scene setup, fish creation, environment creation, WebSocket networking, input, HUD updates, interpolation, camera movement, and animation. The server side and authoritative game logic live under `src/` and remain the source of truth.

## Target client architecture
Keep the app dependency-light and browser-native, but split presentation code into focused ES modules.

- `public/app.js` — application bootstrap and top-level lifecycle only.
- `public/game/config.js` — quality levels, theme constants, gameplay-presentation thresholds.
- `public/game/scene.js` — renderer, camera, lights, resize handling, scene lifecycle.
- `public/game/themes.js` — shared theme contract plus `stylized` and `deep-sea` theme definitions.
- `public/game/environment.js` — seabed, rocks, coral, kelp, plankton, bubbles, light shafts, ambient animation.
- `public/game/fish.js` — procedural fish rig, material variants, fins/tail animation, growth scaling, local/remote visual identity.
- `public/game/effects.js` — eat burst, growth pulse, floating score, danger pulse, camera impulse.
- `public/game/network.js` — WebSocket connection, reconnect, ping, snapshot events, and event callbacks.
- `public/game/input.js` — keyboard, mouse/pointer steering, touch joystick, vertical movement controls.
- `public/game/state.js` — client presentation state derived from server snapshots.
- `public/ui/hud.js` — HUD, mass progression, score, player count, ping, room, depth, leaderboard, danger state.
- `public/ui/lobby.js` — start screen, nickname/room persistence, theme/quality preferences, play lifecycle.
- `public/ui/toast.js` — transient event messages.

The modules must communicate through explicit functions and callbacks rather than importing mutable state from one another.

## Phase A visual design

### Fish character system
Each fish is a procedural rig built from reusable Three.js geometry and materials. The rig contains a body, caudal tail, dorsal fin, paired pectoral fins, optional ventral fin, eyes, pupils, and a mouth marker. Animation uses lightweight transforms rather than skeletal animation.

The local fish uses a brighter cyan/teal identity with a soft emissive rim. Remote fish colors remain stable by hashing player id. Size continues to derive from the cube root of mass. Tail and fin motion scales with measured movement speed so idle fish drift gently while moving fish visibly swim.

Growth tiers alter presentation without changing collision rules: larger fish receive slightly broader fins, stronger rim lighting, a more pronounced trail, and wider camera framing. No tier changes the server mass value or movement rules.

### Stylized ocean environment
The ocean uses layered depth gradients, exponential fog, hemisphere/directional lighting, subtle caustic-like projected motion, procedural rock/coral/kelp clusters, bubbles, and plankton particles. Environment meshes use instancing or shared geometry/materials where practical.

The seabed must look intentional rather than wireframe-only. Decorative objects remain non-colliding and cannot imply gameplay blockers that the server does not know about.

### Gameplay feedback
- Eating food: compact particle burst, floating `+score`, short emissive pulse.
- Eating a smaller fish: stronger burst, camera impulse, growth ring, toast.
- Being eaten: danger flash followed by respawn feedback; no blocking modal.
- Nearby larger fish: HUD danger indicator based on snapshot mass comparison and approximate distance.
- Growth: smooth scale interpolation remains; add a short visual pulse when the displayed mass crosses a meaningful threshold.

All effects must be bounded and pooled or time-limited so long sessions do not leak objects.

## Phase B visual design

### Theme behavior
`Deep Sea` is selected with a theme toggle in the lobby/settings area and persisted in local storage. Theme changes may be applied before starting a session and, when safe, live during a session without reconnecting.

### Deep-sea presentation
Deep Sea uses darker blue/green water, denser distance fog, narrower and more directional light shafts, lower saturation, more physically rough materials, smaller high-frequency plankton, and reduced neon emission. Fish keep the same procedural rig but use more natural gradients and subtler eye/body contrast.

The mode may increase environment density only within the same quality budget. It must not introduce gameplay visibility so poor that a player cannot identify edible food, their own fish, nearby threats, HUD state, or movement direction.

## UI/UX design

### Lobby
The lobby becomes a full-screen game shell rather than a centered form floating over an empty scene. It contains:
- `ABYSS EATER` title and short survival tagline.
- Nickname and room fields.
- Theme selector: `Stylized` (default) and `Deep Sea`.
- Quality selector: `Auto`, `High`, `Balanced`, `Low`.
- Primary `Dive In` action.
- Compact controls legend.
- Live-rendered ocean background from the selected theme.

The layout must work at desktop and mobile widths and respect safe-area insets.

### HUD
The in-game HUD contains:
- Mass and a growth/progression bar.
- Score and rank.
- Player count and ping.
- Current room and connection state.
- Depth meter derived from local player Y position.
- Top-player leaderboard.
- Danger state when a significantly larger nearby fish is detected.
- Compact pause/settings button for theme/quality/preferences.

HUD components use translucent surfaces but must remain readable over both themes.

### Mobile controls
Replace the current directional button cluster with an analog virtual joystick for planar movement. Keep dedicated vertical up/down buttons. Pointer events must support touch and pen. Buttons and joystick respect safe areas and have minimum practical touch target sizes.

### Desktop controls
Keep WASD/arrows plus Space/Shift. Add mouse/pointer steering as an optional simultaneous control method: pointer displacement from screen center maps to planar direction, with a dead zone so UI interactions do not move the fish unexpectedly. Pointer steering is disabled while interacting with form/settings elements.

## Performance and accessibility
- Cap renderer pixel ratio based on selected quality.
- Use shared geometry/materials and instancing for repeated decoration.
- Avoid per-frame allocations in hot animation loops where practical.
- Reduce decorative density on mobile/low quality.
- Respect `prefers-reduced-motion` by reducing camera impulse, pulsing, and particle intensity.
- Preserve semantic labels and visible focus states for lobby/settings controls.
- Canvas remains decorative to screen readers while DOM HUD/status text exposes game state.

## Data and networking
The WebSocket protocol remains compatible with the existing Worker. The presentation layer consumes `welcome`, `snapshot`, `pong`, `eaten`, and `error` messages. Leaderboard, danger detection, depth, and growth feedback are derived locally from snapshot fields already present (`id`, `name`, `mass`, `score`, `position`) when available.

If `name` or `score` is missing for a remote player, the UI must fall back gracefully to a short player id and zero/unknown score rather than requiring a server migration.

## Quality modes
`Auto` chooses a quality tier from coarse pointer/device width/devicePixelRatio heuristics and can be refined by frame-time sampling later without changing the public contract.

- `High`: DPR up to 2, full decorative density, full light/effect budget.
- `Balanced`: DPR up to 1.5, medium decorative density, reduced particle counts.
- `Low`: DPR up to 1, sparse decorations, reduced effects and shadow-like extras.

No mode may disable gameplay-critical objects.

## Testing strategy

### Automated
Add browser-independent unit tests for pure utilities and state derivation using the existing Node test runner. Tests cover theme preference normalization, quality normalization, leaderboard sorting, growth progress calculation, danger detection, and input vector normalization.

Update production bundle/static tests so all new modules are included in the Worker asset bundle and referenced paths exist.

Run the repository's existing Node test suite and production build/bundle checks after each implementation phase.

### Manual acceptance
Desktop:
1. Lobby renders cleanly at 1440×900 and 1024×768.
2. Keyboard and pointer steering both work.
3. HUD updates mass, score, players, ping, room, rank, depth, leaderboard.
4. Fish animate while moving and scale smoothly as mass increases.
5. Effects fire on food/eat/respawn events without accumulating stale objects.
6. Theme switch changes presentation without changing multiplayer behavior.

Mobile/coarse pointer:
1. Lobby fits without clipped controls.
2. Analog joystick moves in all planar directions.
3. Up/down controls remain reachable with one hand.
4. HUD does not cover the primary movement area.
5. Low/Balanced quality maintains usable rendering.

## Delivery
Implementation occurs on `feat/full-game-uiux-overhaul` starting from `main` commit `fedc0d20bdc9a951236bbb0934476ffe1f30123a`.

Phase A is implemented, tested, and committed first. Phase B is implemented, tested, and committed only after Phase A is stable. The final branch should contain separate, reviewable commits for the shared architecture, Phase A presentation, and Phase B theme where practical.