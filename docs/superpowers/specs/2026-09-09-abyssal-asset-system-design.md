# Abyss Eater — Abyssal Asset System Design

## Status

Approved visual direction from the 2026-09-09 design review. This document is the implementation baseline for the first production asset overhaul.

## Goal

Give Abyss Eater a recognizable visual identity that communicates gameplay at a glance while preserving the current browser-first performance model. The visual progression must feel **cute when small, beautiful at mid-size, intimidating when large, and terrifying at Leviathan scale**.

## Art Direction

**Name:** Abyssal Bioluminescence

**Style:** stylized 3D, semi-fantasy marine life, readable silhouettes, restrained emissive lighting, strong depth atmosphere, lightweight procedural geometry where practical.

The game must not chase photorealism. The target is a premium web-game look with clear gameplay readability and modest asset payloads.

### Color language

- Deep navy / teal: ocean, neutral world space, UI background.
- Cyan / aqua: local player, safe/positive gameplay feedback.
- Violet / magenta: rare or special creatures and high-value events.
- Amber / coral: food, rewards, collectible emphasis.
- Crimson: danger, predator warnings, death/critical states only.

## Technical Strategy

Use a **hybrid asset system**:

1. Keep procedural Three.js geometry for common runtime entities where it is lightweight and expressive.
2. Add reusable geometry variants, material patterns, emissive masks, and small SVG/UI assets rather than one heavy model per skin.
3. Reserve GLB/PBR assets for hero or environment pieces that cannot be represented convincingly with procedural geometry.
4. Preserve procedural fallbacks so a failed optional asset load never produces a blank game or broken player entity.
5. Reuse `InstancedMesh` for repeated environment props.

## Fish System

### Evolution silhouettes

Fish appearance must change with growth instead of only scaling one body mesh.

Initial visual tiers:

1. `fry`
2. `reefling`
3. `hunter`
4. `razorfin`
5. `abyss-predator`
6. `leviathan`

Tier changes may adjust:

- body length and height ratio
- head / jaw proportion
- tail fork geometry
- dorsal / ventral fin count and size
- pectoral fin shape
- spine silhouettes
- eye size and glow
- lateral-line emissive accents

The silhouette must make relative threat easier to read before the player inspects score or mass.

### Skin families

Initial family vocabulary:

- Azure
- Coral
- Toxic
- Ember
- Aurora
- Void
- Royal
- Pearl
- Tiger
- Koi
- Spectral
- Leviathan

These are material/pattern families, not twelve separate required meshes. Variants should reuse shared geometry wherever possible.

### Local-player recognition

Replace the current full-body glow shell as the primary local-player cue with localized bioluminescence:

- gill accent
- lateral-line glow
- fin-edge glow
- restrained pulse on the local player only

A fallback full-body glow may remain at very low opacity for accessibility/readability.

## Food and Small Creatures

Replace the generic polyhedral food presentation over time with lightweight marine-life silhouettes:

- plankton glow
- krill cluster
- baby jellyfish
- crystal shrimp
- lantern seed
- golden prey

Rarity must be communicated through silhouette, motion, pulse frequency, and emissive intensity — not color alone.

## Environment System

Build on the existing procedural ocean environment and introduce biome-specific visual language.

### Biomes

- **Sunken Reef:** turquoise water, coral pink/amber, brighter caustics.
- **Twilight Garden:** blue/violet water, giant kelp, drifting jellyfish.
- **Blue Trench:** darker cyan, high rock walls, stronger marine snow.
- **Volcanic Rift:** basalt, vents, warm particles, sparse vegetation.
- **Ancient Abyss:** skeletal/ruin silhouettes and monumental coral.
- **Leviathan Depths:** near-black water with creature-driven light sources.

### Reusable environment props

- branching coral
- fan coral
- tube sponge
- brain coral
- sea anemone
- kelp blade
- sea grass
- barnacle cluster
- shell cluster
- basalt rock
- sandstone rock
- crystal rock
- bone fragments
- rib cage
- hydrothermal vent
- ancient ruin pieces

Repeated props should use instancing whenever practical.

## VFX Language

### Bite

- short impact flash
- bubble burst
- compact distortion/energy ring

### Eat

- particle implosion toward predator
- brief food-value sparkle

### Growth / evolution

- expanding cyan/aqua ring
- short body-line pulse from head to tail
- stronger effect only when an evolution tier changes

### Dash / movement

- short fin/body trail proportional to velocity
- no persistent bloom that obscures silhouettes

### Danger

- restrained crimson vignette or directional pulse when a clearly larger threat approaches
- danger effects must never permanently tint the scene

### Spawn / death

- spawn: compact water vortex / bubble bloom
- death: dissolve to bubbles / plankton rather than abrupt disappearance

## HUD and Brand Assets

UI should look like part of the underwater world, not a SaaS dashboard.

Required brand/UI asset families:

- Abyss Eater wordmark
- compact app mark / favicon / PWA icon
- mass icon
- crown / leaderboard icon
- skull / death icon
- jaw / eat icon
- speed / boost icon
- evolution icon
- shield icon
- settings / audio icon
- keyboard / mouse / touch input icons

Prefer SVG for interface icons and marks.

### HUD modules

- mass orb / mass readout
- evolution progress meter
- boost meter
- combo counter
- danger indicator
- leaderboard cards
- minimap rim / world cue
- ping / connection state

## Menu and Loading Direction

- Splash: tiny player silhouette above a distant Leviathan silhouette.
- Main menu: live 3D ocean scene where practical instead of a static image.
- Fish selection: aquarium-style preview viewport.
- Loading: small fish chasing one glowing plankton.

## Asset Layout

```text
public/
  assets/
    brand/
    ui/
      icons/
      badges/
      frames/
    textures/
      fish/
      fx/
      environment/
    models/
      fish/
      environment/
      creatures/
    audio/
      ambience/
      movement/
      bite/
      ui/

  game/
    assets.js
    fish-factory.js
    fish-materials.js
    creature-factory.js
    environment-factory.js
    effects.js
```

This is a target layout, not a requirement to create empty directories. Files should be introduced only when they have a concrete responsibility.

## Runtime / Performance Constraints

- Browser-first, compatible with the existing Three.js client.
- Do not require paid external asset services or paid runtime dependencies.
- No asset change may make game startup dependent on an optional model or texture.
- Shared geometry/material patterns should be reused rather than duplicated per player.
- Repeated environment objects should use instancing where practical.
- Effects must degrade gracefully under lower graphics profiles.
- Current multiplayer protocol and authoritative gameplay logic are out of scope for the visual overhaul.

## First Implementation Slice

The first production slice should be intentionally narrow and demonstrable:

1. Add deterministic fish evolution-tier selection from mass.
2. Give each tier a materially different silhouette using reusable procedural geometry.
3. Add localized gill/lateral-line/fin emissive accents for the local player.
4. Replace food presentation with a small marine-life inspired procedural form while keeping the same gameplay entity/protocol.
5. Add a compact growth/eat VFX pass that reuses existing effects infrastructure.
6. Add regression tests for tier mapping, fish lifecycle/disposal, and visual feature wiring where testable without WebGL rendering.

Environment biomes, full skin catalog, brand/logo assets, menu overhaul, and GLB hero assets remain later slices.

## Acceptance Criteria for First Slice

- Existing network protocol remains unchanged.
- Existing player movement/camera behavior remains unchanged.
- Fish silhouettes visibly differ across growth tiers.
- Local player remains immediately identifiable without relying solely on a full-body glow shell.
- Food is visibly marine-themed rather than a generic standalone polyhedron.
- New visual resources are disposed with fish/food lifecycle and do not introduce known per-entity GPU leaks.
- Existing tests stay green and new deterministic non-WebGL logic is covered by tests.
- The game remains usable if optional future assets are missing.

## Non-Goals for First Slice

- No paid asset packs or paid APIs.
- No photorealistic PBR overhaul.
- No gameplay balance changes.
- No server protocol changes.
- No full biome system yet.
- No mandatory external 3D model download at runtime.
