# Abyss Eater V1 Scale Evidence

Generated from `npm run profile:scale` on the Carrier 6 qualification host using 2,000 JSON serialization iterations per case.

## Decision

**`JSON_KEEP`** — retain protocol v2 JSON snapshots and do not add a binary codec for V1.

The binary-evaluation trigger is either a 20-player full-snapshot p95 above **32 KiB** or serialization cost above **2.5 ms per snapshot**. The measured 20-player full case was **9,926 bytes p95** and approximately **0.1785 ms per snapshot**, below both thresholds.

## Measured workload

| Case | p95 bytes | serialization ms/snapshot |
| --- | ---: | ---: |
| 1-player full | 7,541 | 0.1810 |
| 1-player delta | 194 | 0.0094 |
| 10-player full | 8,649 | 0.1509 |
| 10-player delta | 1,302 | 0.0235 |
| 20-player full | 9,926 | 0.1636 |
| 20-player delta | 2,579 | 0.0381 |

The profiler includes 24 wildlife, 48 food items, 6 hazards and 8 pickups in full snapshots. Delta cases carry only changing player state. The authoritative network cap remains **20 Hz**.

## V1 tuning choice

The existing client interpolation via `rig.position.lerp` remains the bounded visual smoothing mechanism. Server snapshots remain coalesced to at most 20 Hz, while unchanged food, wildlife, hazards and pickups remain delta-retained client-side.

Adding binary snapshots would increase protocol and fallback complexity without a measured V1 bottleneck. Re-run `npm run profile:scale` if entity caps or snapshot fields materially expand; evaluate an optional negotiated codec only if either threshold is crossed.
