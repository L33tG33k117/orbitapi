# #6 — Conditional Skill Chaining with Async State

**Status:** Complete (live). Rides on Foundation A + D.

## Summary
Playbooks can run a step, **wait** for an external event or timer, then continue carrying state
forward — e.g. "detect → wait 1h for a human response → if none, auto-isolate." Replaces static
trigger→immediate-action automation.

## How it works
- A `wait` node parks the run: `status='waiting'` with `waiting_on={kind:'timer'|'event'}`,
  `resume_at` (timers) or `event` name (events), and a `resume_token`. State is preserved.
- **Timer waits** resume via `app/api/cron/playbooks` (partial index `playbook_runs (status, resume_at)`
  finds due runs efficiently).
- **Event waits** resume when a Foundation D webhook endpoint of `target_type='event'` fires with a
  matching `event_name` — `dispatchWebhook` resumes all matching parked runs with the event payload.
- `condition` nodes provide the branching half (e.g. "if no response → isolate").

## Key files
- `lib/playbook-runner.ts` — `wait` node handling, `park()`, `resumePlaybookRun()`
- `app/api/cron/playbooks/route.ts` — timer resume
- `lib/webhook-dispatch.ts` — event resume
- UI: the `wait` node in `playbook-detail.tsx` step editor (timer seconds or event name)

## Gotchas
- Event payload is merged into run `state` on resume so downstream steps/conditions can read it.
- Resumes bypass AI-Power enforcement (already-approved/in-flight work).
