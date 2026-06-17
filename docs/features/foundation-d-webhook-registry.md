# Foundation D — Webhook Registry + HMAC Signing

**Status:** Complete (live, migration 031 applied)

## Summary
A first-class inbound webhook registry. Each endpoint has an unguessable URL token AND an HMAC
signing secret sent in the `X-Orbit-Signature` header (not the URL — fixes the leak in the old
`/api/webhooks/skills/:id?secret=` scheme). Every delivery is logged; endpoints can run a skill,
run a playbook, or emit a named event that resumes async-waiting playbook runs (#6).

## How it works
- Sender computes `sha256=HMAC_SHA256(signing_secret, rawBody)` → `X-Orbit-Signature` header.
- Receiver `/api/hooks/[token]` looks up the endpoint, verifies the signature (constant-time),
  logs the delivery (incl. rejects), then dispatches.
- Dispatch (`lib/webhook-dispatch.ts`): `skill` → runSkill; `playbook` → runPlaybook; `event` →
  resume `playbook_runs` parked on `waiting_on.kind='event'` matching `event_name`.

## Key files
- `lib/webhooks.ts` — `generateToken`, `generateSigningSecret`, `sign`, `verifySignature`, `SIGNATURE_HEADER`
- `lib/webhook-dispatch.ts` — shared dispatch (used by receiver + replay)
- `app/api/hooks/[token]/route.ts` — inbound receiver
- `app/api/webhooks/route.ts`, `.../[id]/route.ts`, `.../[id]/replay/route.ts` — management + replay
- See also: webhook-dashboard.md (#10 UI)

## Data model (migration 031_webhooks.sql)
- `webhook_endpoints` — token (unique), signing_secret, target_type (skill/playbook/event), target_id,
  event_name, payload_schema, enabled, require_signature, last_delivery_at
- `webhook_deliveries` — headers/payload (jsonb), signature_valid, status (received/rejected/dispatched/failed),
  dispatch_summary, error, is_replay

## Gotchas
- The inbound receiver uses the admin client (bypasses RLS) — it authenticates via token + HMAC, not a session.
- `require_signature=false` allows quick testing; on = enforced HMAC (401 on bad/missing sig).
- Event endpoints are the trigger half of #6 async chaining (timers resume via cron).
