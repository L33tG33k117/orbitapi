# #3 — AI Cross-Connector Data Mapping

**Status:** Complete (live).

## Summary
Sync records between two connected apps (e.g. Zendesk tickets → ServiceNow incidents). Orbit pulls a
live sample from the source, proposes field mappings to the target's input schema, and previews the
transformed record before anything runs.

## How it works
- `/api/data-mapping/propose` takes `{ sourceConnectionId, sourceAction, targetConnectionId, targetAction }`.
- It runs the **source read action** (simulated or live) to get a sample record, reads the **target
  write action's inputSchema**, and asks the model to produce `{ mappings[], preview, unmapped[] }`.
- Read-only on the source; never writes the target. The UI shows source→target field mappings, a
  transformed preview, and flags unmapped required fields.

## Key files
- `app/api/data-mapping/propose/route.ts` — sample + AI mapping (admin only)
- `app/(dashboard)/data-mapping/page.tsx` — loads connections + their read/write actions
- `app/(dashboard)/data-mapping/data-mapping-client.tsx` — source/target pickers + mapping + preview
- Nav: top-level "Data Mapping" (cross-connector workflows are a core value prop)

## Gotchas
- Source action must be a `read` action (enforced).
- The preview is a dry transform against one record; wire it into a playbook action step to automate the sync.
