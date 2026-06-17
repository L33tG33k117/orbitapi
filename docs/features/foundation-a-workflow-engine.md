# Foundation A — Workflow / Playbook Execution Engine

**Status:** Complete (live, migration 028 applied)

## Summary
A step-graph execution engine that replaces the single-shot skill model with multi-step,
conditional flows. Supports **severity-driven autonomy** (auto-act / require approval / notify
by severity band) and **park-and-resume** (a run can pause on an approval, timer, or external
event and continue later carrying its state forward).

## How it works
- A **playbook** has a `definition.steps[]` graph and an `autonomy_policy` (severity→mode bands).
- The engine (`lib/playbook-runner.ts`) walks the graph node by node. Node types:
  - `assess` — AI reads (read-only tools) and scores severity 0–10, writes findings to `state`
  - `action` — runs a connector action; write actions are gated by the autonomy policy
  - `condition` — branches on a safe expression over `state` (e.g. `state.open > 0`)
  - `approval` — stages a `pending_action` and **parks** the run
  - `notify` — in-app notification, never writes
  - `wait` — parks on a timer (`wait_seconds`) or an event (`wait_event`)
- **Autonomy gate:** for write actions, severity → policy band → `auto` (execute), `approval`
  (park + stage pending_action), or `notify` (skip + notify).
- **Park/resume:** parked runs are `status='waiting'` with `resume_token`, `waiting_on`, and
  `resume_at`. `resumePlaybookRun()` continues from the parked node. Approvals resume via the
  pending-actions confirm/reject routes; timers resume via the cron; events via webhooks.

## Key files
- `lib/playbook-runner.ts` — `runPlaybook`, `resumePlaybookRun`, `executeFrom`, `assess`
- `app/api/playbooks/route.ts`, `app/api/playbooks/[id]/route.ts`, `.../[id]/run/route.ts`
- `app/api/cron/playbooks/route.ts` — resumes timer-parked runs + triggers scheduled playbooks
- `app/api/pending-actions/[id]/confirm|reject/route.ts` — resume on approval decision

## Data model (migration 028_playbooks.sql)
- `playbooks` — definition (jsonb step graph), autonomy_policy (jsonb), group_id, trigger_type, schedule, source
- `playbook_runs` — state (jsonb), steps (jsonb log), status (running/waiting/completed/failed/cancelled),
  severity, autonomy_decision, current_step, waiting_on, resume_token, resume_at
- Also widened `audit_log.actor_type` CHECK to allow `'skill'`/`'playbook'`

## Gotchas
- The expression evaluator is intentionally minimal/safe (comparisons over `state.x`), not arbitrary JS.
- Resume re-runs the parked node (e.g. an approved action executes on resume — single audited path).
- Resumes are exempt from AI-Power enforcement (the work was already approved).
