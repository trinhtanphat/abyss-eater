# Abyss Eater V1 Full A+B+C Design

## Purpose

Turn the current Abyss Eater MVP into a production-oriented browser game that combines all three requested directions:

- **A — production hardening and persistent progression**
- **B — complete MVP polish and reliability**
- **C — broader gameplay, social features and content**

The design keeps the current server-authoritative Cloudflare Workers + Durable Objects architecture, remains browser-first, and stays compatible with free-plan operation. It does not introduce real-money payments or intentionally enable paid Cloudflare products.

## Product goals

A V1 player should be able to open the game on desktop or mobile, enter quickly as a persistent guest profile, find or create a suitable room, play a polished 3D fish-survival loop, encounter AI wildlife and multiple depth biomes, earn progression currency, unlock cosmetic skins, view leaderboards, form a lightweight party, use moderated room chat, reconnect safely after transient network loss, and continue their profile across later sessions on the same identity.

V1 remains an `.io`-style session game rather than an MMO. A room still has a bounded player target, while matchmaking creates additional rooms as needed.

## Non-goals and cost boundary

V1 does **not** include:

- real-money purchases, subscriptions or payment processing;
- paid-only Cloudflare products intentionally enabled by this project;
- player-to-player trading;
- user-generated executable content;
- voice chat;
- guilds/clans;
- a single 1,000-player authoritative simulation;
- mandatory third-party identity providers;
- AI-generated moderation that incurs external inference cost.

If a free-tier quota is exhausted, the product should degrade or reject new work rather than silently switch to a billable service.

## System architecture

```text
Browser / PWA client
  |-- HTTPS API: profile, inventory, leaderboard, matchmaking, party
  |-- WebSocket: authoritative room state + room chat
  v
Authoritative Worker: abyss-eater (trinhtanphat6666)
  |
  |-- GameRoom Durable Object (one per active room)
  |     movement, collisions, eating, food, AI, biome state,
  |     reconnect slots, room chat rate limiting, snapshots
  |
  |-- Matchmaker Durable Object
  |     room registry, capacity, regional buckets, party placement
  |
  |-- Party Durable Object
  |     lightweight party membership/invite code/readiness
  |
  `-- D1 persistence
        profile, inventory, progression, durable leaderboard rows,
        session identity metadata and moderation/report records

Public hostname
  abyss-eater.qs3d.site
  -> thin gateway Worker in trinhtanphat2403
  -> abyss-eater.hikvision.workers.dev
```

The gateway remains stateless and must not own gameplay, identity, profile or social state.

## Identity and sessions

V1 uses a **persistent guest-first identity** instead of email/password authentication.

On the first visit, the server creates a random player identity and returns a signed session credential. The browser stores the opaque credential locally. The credential identifies the profile but never encodes authoritative score, inventory or balance. Server-side validation checks signature, expiry/version and profile status.

Session requirements:

- random high-entropy profile id;
- signed opaque session token using a production Worker secret;
- token rotation/version support;
- no secrets checked into GitHub;
- no client ability to choose profile id, balance or inventory;
- same profile may reconnect after a transient disconnect;
- a single profile has a bounded number of simultaneous live room presences;
- corrupted/invalid tokens fall back to a new guest flow without exposing server internals.

Account linking to email or OAuth is deferred until there is a real product need.

## Persistent data model

D1 is used only for durable cross-room data. Hot room simulation never performs a database write for every movement tick.

Core tables:

### `profiles`

- `id`
- `display_name`
- `created_at`
- `updated_at`
- `xp`
- `level`
- `pearls`
- `selected_skin_id`
- `best_mass`
- `best_score`
- `games_played`
- `total_eaten`
- `status`
- `session_version`

### `skins`

Static catalog metadata such as id, title, unlock level, pearl cost and rendering parameters. The canonical catalog remains version-controlled; D1 stores ownership, not executable skin code.

### `profile_skins`

- `profile_id`
- `skin_id`
- `unlocked_at`

### `leaderboard_entries`

Season-aware durable bests and aggregate stats. Room-local live ranking remains in memory; durable writes occur at bounded checkpoints/end-of-life events rather than every snapshot.

### `moderation_reports`

Minimal report metadata for room chat/player abuse. Avoid collecting unnecessary personal information.

All balance/inventory mutations are transactional and server-owned.

## Progression and cosmetic economy

V1 has **in-game currency only** named `pearls`.

Pearls are earned from server-validated play events such as survival milestones, food/player consumption and end-of-session rewards. Cosmetic purchases spend pearls transactionally. A client request may ask to buy a known skin id but cannot provide the price or resulting balance.

Skins change visual parameters only. They must not alter collision radius, speed, mass, hitbox or authoritative gameplay.

Progression includes:

- XP and level;
- pearls;
- cosmetic unlocks;
- best mass / best score;
- session and seasonal leaderboard views.

## Matchmaking and regions

Players may still enter a named private room, but the default path becomes **Quick Dive**.

The Matchmaker Durable Object tracks active rooms using soft capacity records and heartbeats generated by meaningful room events rather than perpetual timers. Placement considers:

1. requested party/private room constraint;
2. coarse region bucket inferred from Cloudflare request metadata;
3. available capacity;
4. room lifecycle state;
5. fallback to creating a new room id.

Initial region buckets are coarse (`SEA`, `JP`, `EU`, `NA`, `OTHER`) rather than pretending to provide dedicated servers in every country. Cloudflare edge routing still determines actual execution locality.

The initial public-room target remains around 20 players. Capacity may be tuned after profiling, but V1 does not claim 40+ players until load evidence supports it.

## Reconnect and room lifecycle

A transient WebSocket loss should not immediately destroy a player's session.

`GameRoom` maintains a short reconnect grace slot keyed by profile/session identity. During grace:

- the fish is frozen or placed in a safe non-interactive reconnect state;
- it cannot eat or be used to farm score;
- the slot expires deterministically based on timestamps evaluated on room activity/alarm where required;
- successful reconnect rebinds the WebSocket without granting duplicate rewards.

Room lifecycle rules bound stale state and storage. Empty rooms may hibernate; no perpetual simulation timer is allowed. Background AI advances only when the room receives gameplay work or a deliberately bounded scheduled/alarm step needed for correctness.

## Authoritative simulation hardening

The server remains the sole authority for:

- position;
- movement speed;
- world bounds;
- mass;
- collision/eating;
- food and pickup consumption;
- AI state;
- score;
- respawn;
- progression rewards.

Input hardening adds:

- message byte-size limit;
- strict schema/version checks;
- monotonic input sequence validation;
- bounded messages per time window;
- normalized direction clamping;
- invalid-number rejection;
- stale/future sequence rejection;
- reconnect replay protection;
- bounded player-name and room/chat payloads;
- explicit protocol error codes without raw stack traces.

The server records only enough recent input timing to detect impossible spam; it does not trust client frame rate or position prediction.

## Game world and biome progression

The room becomes one coherent 3D ocean with depth-based biomes:

### Surface

Bright, open water, small plankton and starter fish. Safest onboarding zone.

### Reef

Coral-like procedural obstacles, denser food, small AI schools and moderate predators.

### Deep Ocean

Lower visibility, larger AI species, stronger reward density and environmental hazards.

### Abyss

Dark high-risk layer containing apex predators/boss-class wildlife and the best session rewards.

Biome boundaries are gameplay zones rather than separate server shards. Authoritative depth limits and biome membership are derived from server position.

## AI wildlife

AI wildlife is server-owned and deterministic enough for tests.

V1 includes several behavior classes:

- schooling prey fish;
- neutral fish that flee larger entities;
- predator fish that acquire nearby valid prey;
- apex/boss creature with a simple state machine;
- jellyfish/hazard actors that are not normal edible prey at every mass threshold.

AI must have strict per-room population and work budgets. Spatial queries use a simple grid/bucket structure before considering heavier algorithms. AI updates are tied to bounded simulation steps and cannot create an unbounded Worker CPU loop.

## Pickups and environmental systems

In addition to plankton, V1 may spawn server-authoritative pickups such as temporary speed, pearl clusters or score multipliers. Any temporary gameplay buff has a server timestamp expiry and a bounded effect.

Environmental presentation includes bubbles, particulate fog, current-like visual motion, reef silhouettes, deep-sea lighting and procedural scenery. Decorative client-only particles never participate in collisions.

## Client polish (B scope)

The current MVP shell is upgraded into a complete responsive game flow:

- splash/loading state;
- first-run profile creation;
- Quick Dive and private-room entry;
- profile/progression panel;
- skin selection/shop panel;
- leaderboard panel;
- party panel;
- room HUD;
- death/respawn feedback;
- connection/reconnect status;
- settings for quality, audio and controls;
- mobile touch controls with safe-area handling;
- keyboard accessibility for non-gameplay menus;
- reduced-effects/low-quality mode;
- clear unsupported-WebGL/browser error state.

The game remains playable without installing it. PWA metadata and a service worker may cache the application shell and static local assets, but realtime gameplay always requires the network.

## Rendering and assets

Three.js stays the renderer for V1. The current CDN import may remain temporarily, but production hardening should prefer a version-pinned local/vendor asset if doing so remains lightweight and compatible with the build pipeline.

External GLB/glTF assets are allowed for cosmetic/environment content only after they have:

- clear redistribution rights;
- pinned source/version;
- bounded download size;
- fallback procedural rendering;
- no runtime dependency on an unreliable third-party origin.

The first V1 content pass should remain largely procedural to avoid asset/licensing complexity. Draco/Meshopt is introduced only when an actual model set justifies it.

## Audio

V1 adds lightweight audio:

- ambient ocean loop;
- eat/grow feedback;
- damage/death feedback;
- biome ambience transitions;
- UI feedback.

Audio starts only after user interaction and provides independent master/music/SFX controls. The default must be respectful on mobile and when the page is backgrounded.

## Party system

Parties are deliberately lightweight:

- create party;
- short invite code;
- join/leave;
- leader can start Quick Dive;
- matchmaker keeps the party together when capacity permits;
- no guild persistence;
- no cross-game voice features.

Party membership is transient Durable Object state with short recovery semantics. Durable profile data stores no large party history.

## Room chat and moderation

Room chat is text-only and intentionally constrained.

Server rules include:

- maximum message length;
- per-player rate limit;
- duplicate/spam suppression;
- server-side normalization;
- small deterministic prohibited-term filter for obvious abuse;
- local mute controls;
- report action;
- no clickable raw HTML;
- no arbitrary rich embeds;
- no external AI moderation dependency.

Chat is not part of authoritative movement snapshots and cannot block the simulation loop.

## Leaderboards

Two layers are exposed:

- live room ranking computed directly from current room state;
- durable seasonal/all-time bests read from D1.

Leaderboard write paths are idempotent and bounded. A malicious client cannot submit a score directly; only server-side verified gameplay outcomes produce durable updates.

## Network protocol evolution

V1 keeps JSON as the compatibility baseline and introduces explicit protocol versions.

Before implementing binary snapshots, measure:

- average snapshot bytes;
- 95th percentile snapshot bytes;
- player count;
- messages per second;
- Worker CPU time attributable to serialization.

Only if the measured JSON path is materially limiting does the server add a binary snapshot codec. Binary support must be negotiated by protocol capability so older clients receive JSON rather than failing silently.

Thus binary networking is included in the **V1 optimization scope**, but its activation is evidence-gated rather than automatic complexity.

## Performance strategy

Client:

- interpolation buffer for remote actors;
- client-side prediction for local visual movement without authoritative state mutation;
- object/material reuse;
- capped pixel ratio and quality presets;
- frustum/distance-based decorative reduction;
- background-tab throttling.

Server:

- bounded simulation delta;
- spatial buckets for food/AI/player proximity;
- batched snapshots rather than per-entity messages;
- no unbounded timers;
- no D1 write per movement input;
- hard caps on players, AI, food, chat rate and payload sizes.

## Security and abuse controls

V1 security requirements:

- HMAC/session secret stored only as a Cloudflare secret;
- CSP and existing security headers tightened for the final asset strategy;
- origin/gateway path does not expose internal secrets;
- all API mutations require validated session identity;
- shop/progression/leaderboard writes are server-derived;
- chat output is text only;
- room and party identifiers are canonicalized;
- all public endpoints return stable bounded error bodies;
- log records avoid session credentials and unnecessary personal data;
- replay/idempotency guards for reward and purchase mutations;
- no admin/debug endpoint enabled publicly by default.

## Reliability and failure behavior

- D1/profile failures must not corrupt active authoritative room state.
- If persistence is temporarily unavailable, gameplay may continue as an explicitly non-persisting session only when rewards are not falsely acknowledged; otherwise reward-changing operations fail closed.
- Matchmaking failure may fall back to a generated room only when doing so does not split a party unexpectedly.
- Gateway failure is observable but never stores recovery state.
- WebSocket protocol version mismatch returns a clear upgrade error.
- Client shows retry/reconnect UI instead of silently freezing.

## Observability

Use free-compatible Worker logging/analytics already available to the account without intentionally enabling paid products.

Structured events should cover:

- room creation/closure;
- current/max player count;
- reconnect success/failure;
- protocol rejects by code;
- matchmaker placement outcome;
- persistence mutation failure classes;
- game-session completion summary;
- WebSocket abnormal close counts.

Never log full session tokens or raw chat by default.

## Testing strategy

### Pure unit tests

- movement and collision rules;
- progression calculations;
- shop transaction validation;
- matchmaker selection;
- region mapping;
- AI state machines;
- spatial bucket membership;
- session token parsing/signing helpers with injected test keys;
- chat normalization/rate rules;
- protocol parsing and limits;
- binary codec round trip if/when activated.

### Deterministic room simulations

- 20-player movement under bounded inputs;
- reconnect without duplicate player/reward;
- simultaneous eat conflicts resolved deterministically;
- AI population caps;
- boss/predator transitions;
- room empty/hibernate recovery;
- stale input and spam rejection.

### Persistence tests

- profile create/read/update;
- pearl spend atomicity;
- idempotent reward writes;
- skin ownership;
- leaderboard update monotonicity;
- migration forward compatibility.

### Build/static tests

- all application routes/assets embedded or correctly served;
- CSP/security headers;
- manifest/service-worker consistency;
- Worker binding names and migration metadata;
- gateway origin constant;
- no production secret literals in repository.

### CI

Node 22 CI must remain secret-free and run the deterministic suite/build/syntax checks. Cloudflare deployment credentials are not required for pull-request validation.

## Delivery carriers

Implementation is deliberately split so each carrier can be verified and deployed independently.

### Carrier 1 — multiplayer hardening

Protocol versioning, rate limits, sequence validation, reconnect grace, room lifecycle, deterministic conflict resolution and spatial buckets.

### Carrier 2 — MVP polish

Responsive shell, loading/death/reconnect flows, settings, quality levels, audio framework, accessibility/PWA improvements and production asset hardening.

### Carrier 3 — persistence and progression

D1 schema/migrations, persistent guest session, profile API, XP/levels, pearls, cosmetic catalog/ownership, shop and durable leaderboard.

### Carrier 4 — world and AI

Depth biomes, AI schools/predators, apex/boss state machine, hazards, pickups and richer procedural world presentation.

### Carrier 5 — social and matchmaking

Quick Dive regional matchmaker, private rooms, Party Durable Object, room chat, mute/report and moderation limits.

### Carrier 6 — measured scale optimization

Load instrumentation, snapshot-size metrics, client interpolation tuning and binary snapshot capability only when profiling demonstrates a meaningful gain.

### Carrier 7 — release hardening

Full regression suite, Cloudflare configuration verification, exact production artifact hash verification, README/runbook updates, live HTTP/WebSocket probes from an environment with Internet DNS, rollback notes and V1 release tag.

## Rollout and compatibility

Every carrier keeps the previous production path operable until the replacement is verified. Schema migrations are additive-first. Protocol changes carry a version and maintain a controlled compatibility window where reasonable.

Cloudflare production remains:

- authoritative Worker `abyss-eater` on `trinhtanphat6666`;
- gateway Worker `abyss-eater-gateway` on `trinhtanphat2403`;
- custom domain `abyss-eater.qs3d.site`;
- workers.dev origin retained as an operational fallback unless intentionally disabled later.

No carrier may silently move gameplay authority into the gateway account.

## V1 completion criteria

V1 Full A+B+C is complete only when all of the following are true:

1. Core gameplay remains server-authoritative under hostile input tests.
2. Reconnect works without duplicate live identities or duplicate rewards.
3. Quick Dive can place public players and parties into bounded rooms.
4. Persistent guest profiles, progression, cosmetic ownership and leaderboards survive new sessions.
5. Skin/shop mutations are transactional and cannot create negative or client-selected balances.
6. Surface/Reef/Deep/Abyss progression and bounded AI wildlife are playable.
7. Room chat has rate limiting, mute/report and safe text rendering.
8. Desktop and mobile flows include loading, gameplay, death, reconnect and settings states.
9. CI is green on Node 22 for deterministic tests, build and syntax gates.
10. Production Worker and gateway artifacts are verified against the source-built artifacts.
11. Cloudflare custom domain and Worker deployments are verified without enabling paid services.
12. A real HTTP health/home probe and WebSocket join/input/ping probe pass from a network-capable environment before the V1 release is labeled fully live-verified.
