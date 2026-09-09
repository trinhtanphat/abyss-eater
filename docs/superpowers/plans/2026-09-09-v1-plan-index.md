# Abyss Eater V1 Full A+B+C Plan Index

Implementation is split into independently testable and deployable carrier plans derived from `docs/superpowers/specs/2026-09-09-abyss-eater-v1-full-abc-design.md`.

1. `2026-09-09-v1-carrier-1-multiplayer-hardening.md` — protocol, rate limits, deterministic collisions, reconnect and room lifecycle.
2. Carrier 2 — MVP polish, accessibility, settings, PWA and audio; written immediately before Carrier 2 implementation against the then-current main tree.
3. Carrier 3 — persistent guest identity, D1 progression, pearls, skins/shop and durable leaderboard; written immediately before Carrier 3 implementation.
4. Carrier 4 — biome/world systems, AI wildlife, hazards and pickups; written immediately before Carrier 4 implementation.
5. Carrier 5 — Quick Dive matchmaker, private rooms, party and constrained room chat; written immediately before Carrier 5 implementation.
6. Carrier 6 — measured scale optimization and optional negotiated binary snapshots; written only after profiling data from Carriers 1-5 exists.
7. Carrier 7 — release hardening, exact artifact verification, live probes, rollback/runbook and V1 release qualification.

Each later plan is intentionally authored against the latest merged source so exact paths/interfaces are not guessed before earlier carriers reshape the codebase.