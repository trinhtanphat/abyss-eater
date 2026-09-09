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
