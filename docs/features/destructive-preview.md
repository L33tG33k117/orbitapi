# #9 — Destructive Action Preview + Rollback Reasoning

**Status:** Complete (live). Rides on Foundation B.

## Summary
Before a human approves a write/destructive action, they see an AI-predicted **impact** and a
**reversibility** flag. Destructive actions additionally require a typed **rollback plan**, which is
logged to the audit trail.

## How it works
- `/api/actions/preview` loads the action def (name/description/risk/inputSchema), and for non-read
  actions asks a cheap model to predict concrete impact + whether it's reversible. Read-only: it
  never executes the action or writes audit.
- The Approvals page calls preview on expand; for `destructive` risk it shows the warning and gates
  the "Approve & Execute" button until a rollback plan is entered.
- The approve route logs the rollback plan into `audit_log.result_summary` (`[Rollback plan: …]`).

## Key files
- `app/api/actions/preview/route.ts` — AI impact prediction (uses `CHEAP_MODEL` internally)
- `app/(dashboard)/approvals/page.tsx` — preview fetch on expand, rollback textbox, gated approve
- `app/api/approvals/[id]/approve/route.ts` — accepts `rollback_reasoning`, records response/duration

## Gotchas
- Impact text is a prediction, not a dry-run of the real system (most connectors can't preview).
- Reversibility is derived from the connector's `risk` classification (`destructive` = irreversible).
