# #5 — Real-Time Action Replay

**Status:** Complete (live). Rides on Foundation B.

## Summary
Every audit entry expands to a full detail card (params, response, duration, actor) with a one-click
**Replay with fresh data** button that re-runs the exact action.

## How it works
- The Audit page loads enriched `audit_log` rows (params, response, duration_ms, connection_id, replay_of).
- Expanding a row shows params + response (pretty JSON) + actor + latency.
- "Replay" (admin, when `connection_id` present) POSTs to `/api/execute` with
  `{ connectionId, actionSlug, params, replayOf }`. The new run is itself audited and linked via
  `replay_of`, and shows a `(replay)` tag.

## Key files
- `app/(dashboard)/audit/page.tsx` — loads replay-capable fields
- `app/(dashboard)/audit/audit-table.tsx` — expandable rows + replay button + filters
- `app/api/execute/route.ts` — executes + records response/duration_ms/replay_of (accepts `replayOf`)

## Gotchas
- Replay re-runs against live data (or the simulator for simulated connections) — it's a real execution.
- Members are still grant-gated in `/api/execute` (read vs read_write).
