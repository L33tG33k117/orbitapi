# #10 — Webhook Signature Validation Dashboard

**Status:** Complete (live). Surfaces Foundation D.

## Summary
A first-class UI to register inbound webhook endpoints, copy the URL + signing secret, send test
payloads, and inspect the delivery log with signature-validation results.

## How it works
- Create an endpoint (target: emit event / run playbook / run skill). The dashboard shows the
  `POST /api/hooks/{token}` URL and the `whsec_…` signing secret to copy into the source app.
- "Send test payload" calls `/api/webhooks/[id]/replay` (re-dispatches a payload, logged as `is_replay`).
- Each endpoint expands to its recent deliveries: status (dispatched/rejected/failed), `sig ✓/no sig`,
  dispatch summary/error, timestamp.

## Key files
- `app/(dashboard)/webhooks/page.tsx` (admin-only), `webhooks-client.tsx` (create + per-endpoint detail)
- `app/api/webhooks/route.ts`, `.../[id]/route.ts` (incl. `rotate_secret`), `.../[id]/replay/route.ts`
- Receiver + signing: see foundation-d-webhook-registry.md

## Gotchas
- Sign the **raw body**: `sha256=HMAC_SHA256(secret, body)` in `X-Orbit-Signature`.
- `require_signature` toggle lets you test unsigned, then enforce.
