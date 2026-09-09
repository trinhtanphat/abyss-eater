# Carrier 6 Network Profile

Carrier 6 keeps protocol v2 JSON as the compatibility baseline and enables binary snapshots only when profiling demonstrates a material bottleneck.

## Reproducible command

```bash
npm run profile:network
```

The harness builds deterministic representative full and delta snapshots at 1, 10 and 20 players using the current V1 caps: 42 food, 24 wildlife, 8 hazards and 12 pickups. It measures UTF-8 payload bytes and `JSON.stringify` time with Node's high-resolution timer.

## Decision budgets

- p95 full snapshot bytes: **32 KiB**
- p95 serialization time: **2 ms**
- snapshot broadcast cap: **20 messages/sec**

The byte budget is deterministic for a given source shape. Serialization timing is environment-dependent and must be re-measured when the snapshot schema changes materially.

## Measured baseline

A local Node profile on 2026-09-09 produced:

| Players | Full p95 bytes | Delta p95 bytes | Full p95 serialize | Delta p95 serialize |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 10,271 | 220 | 0.088 ms | 0.003 ms |
| 10 | 11,620 | 1,569 | 0.083 ms | 0.009 ms |
| 20 | 13,135 | 3,084 | 0.121 ms | 0.028 ms |

The 20-player full snapshot is about 40% of the byte budget and roughly 6% of the serialization-time budget in this run. Delta snapshots are substantially smaller.

**Decision:** `binaryRecommended=false` with reason `json_within_budget`. Carrier 6 therefore does **not** add a binary codec. JSON protocol v2 remains the production-compatible path; the profiling command and decision gate remain in-tree so this decision can be revisited when the room shape or caps materially change.
