# Abyss Eater V1 Full A+B+C Qualification

This document defines the terminal qualification for the V1 Full A+B+C source. Exact identifiers are generated from the checked-out commit instead of being hard-coded into a self-referential source commit.

## Exact-head evidence

Run `npm run release:evidence` after the final candidate checkout. `artifacts/release-evidence.json` records the **exact Git SHA**, built **Worker SHA-256**, Worker byte count, service-worker cache name, and required Quick Dive/party/chat shell markers.

Run `npm run profile:scale` on the same checkout. Carrier 6 currently records a 20-player full-snapshot p95 of 9,926 bytes and the decision `JSON_KEEP`; binary snapshots are not required for V1.

## Live qualification

Production delivery is owned by the **connected Cloudflare deployment integration** watching `main`, not by GitHub Actions. GitHub remains CI-only and performs no Wrangler deploy, D1 migration, plan upgrade, or token-driven mutation.

After deployed `main` is observable, run `npm run probe:live`. `artifacts/live-probe.json` checks origin and branded health/home/service-worker endpoints plus bounded WebSocket join → ping → input. Each target reports `PASS`, `FAIL`, or `NO_RESULT`.

A V1 release/tag is qualified only when exact-head CI is green, the release evidence names that head, and the deployed shell/live probes are `PASS`. Missing network evidence is `NO_RESULT`, not an assumed success.

## Free-plan boundary

Qualification enables **no paid service**. No task may upgrade Cloudflare plans, create paid infrastructure, top up credits, or substitute a paid provider. Missing production prerequisites remain fail-closed.

## Rollback

Rollback uses the previously verified game Worker and gateway versions through the connected deployment integration or explicit pinned manual tooling. Do not rewrite Durable Object/D1 migration history and do not delete profile/session/report rows.

After rollback, re-run health, shell and WebSocket probes and record new evidence. A rollback is not terminal until the branded domain and authoritative origin both return the expected prior runtime state.

## Terminal V1 evidence

- Release/tag: `v1-full-abc` — **Abyss Eater V1 Full A+B+C**.
- Qualified source merge: `c55f2db52e82c491d29b47dc29b9c9fb39cb2a05`.
- Post-merge CI run: `34361234094` — SUCCESS on that exact main SHA.
- Qualification artifact: `abyss-eater-qualification` from the post-merge CI run.
- Worker SHA-256: `692fa570d4ae7add90e9a8595eda038dc95f848e0e07bdf34a1763808f326a6e`.
- Worker build: 300,621 bytes / 44 embedded assets.
- Live origin and branded probes: PASS for health, home, service worker, and WebSocket join → ping → input.
- Carrier 6 decision: `JSON_KEEP`; 20-player full snapshot p95 9,926 bytes.

## Post-release hardening qualification

- Hotfix release/tag: `v1-full-abc.1` — **Abyss Eater V1 Full A+B+C Hotfix 1**.
- Qualified hardened runtime source: `86fb47f64dd0d2f36177fe46feab3ad3dd552804`.
- Post-merge CI run: `34362891440` — SUCCESS on that exact main SHA.
- Production smoke run: `34362950491` — SUCCESS on that exact main SHA.
- Visual Review run: `34362572236` — SUCCESS on the merged hotfix tree before merge.
- Fresh local regression: **234/234 PASS**; Worker build **301,571 bytes / 44 assets**.
- Worker SHA-256: `b4227be647e329c3279703a6902349ba9d30cf74161a880cb51bd6cc38c6ec99`.
- Carrier 6 remains `JSON_KEEP`; 20-player full snapshot p95 remains **9,926 bytes**.
- Live origin and branded probes remain PASS for health, home, service worker, and WebSocket join → ping → input.

The original `v1-full-abc` tag remains immutable at the initial qualified V1 runtime. `v1-full-abc.1` records the privacy/party-boundary and visual-review hardening follow-up without changing application SemVer `0.3.0` or enabling any paid service.

This is the terminal Carrier 7 qualification record. The release tag intentionally names the V1 feature milestone without changing the application's existing `0.3.0` SemVer/health version. No paid service was enabled.
