# #1 — Autonomous Response Playbooks with Approval Chains

**Status:** Complete (live). Rides on Foundation A.

## Summary
Multi-step playbooks whose write actions behave differently by **severity**: auto-execute on
critical, pause for human approval on uncertain, just notify on low. The headline differentiator —
dynamic autonomy thresholds inside a conversational platform (vs. XSOAR's static playbooks).

## How it works
- Each playbook has an `autonomy_policy.thresholds[]` = `[{min,max,mode}]` where mode ∈
  `auto | approval | notify`. Default: 9–10 auto, 6–8 approval, 0–5 notify.
- An `assess` step scores severity; the engine resolves severity → mode for each write action.
- `approval` mode (or an explicit `approval` node) stages a `pending_action` routed to the playbook
  owner/admin and **parks** the run; confirming resumes it and executes the approved action.

## Key files
- Engine: `lib/playbook-runner.ts` (see foundation-a)
- UI: `app/(dashboard)/playbooks/page.tsx` (list + create), `.../[id]/page.tsx` (server),
  `.../[id]/playbook-detail.tsx` (client: step-graph editor, autonomy-policy editor, run viewer)
- Create form: `app/(dashboard)/playbooks/create-playbook-form.tsx` (starter templates)

## UI notes
- Step editor supports all node types (assess/action/condition/approval/notify/wait) with reorder.
- Autonomy-policy editor = severity-band rows → mode dropdown.
- Run viewer shows status, severity, autonomy_decision, per-step detail, and cost.

## Gotchas
- Approval routing falls back to any workspace owner/admin if the playbook has no `created_by`.
- Parked approvals expire after 24h (longer than the default 10-min pending_action expiry).
