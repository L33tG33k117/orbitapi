# #4 — Skill / Bundle Marketplace with Revenue Share

**Status:** Complete (live). Rides on Foundation C.

## Summary
Community-published, admin-reviewed bundles you can install, plus a place to publish your own
playbooks/skills with publisher revenue-share fields. The network-effect moat.

## How it works
- Publish: `/api/marketplace` POST serializes selected playbooks/skills via `exportBundle()` (no
  credentials) into a `marketplace_listings` row with `status='pending'`.
- Review: super_admins approve/reject via `/api/marketplace/[id]` PATCH (sets status + reviewer).
- Browse/install: approved bundle listings appear on the Marketplace page and the Bundles page;
  install uses `/api/bundles/install` with `source='marketplace'`, incrementing `install_count`.

## Key files
- `app/(dashboard)/marketplace/page.tsx` — browse + review queue (super_admin) + publish + my submissions
- `app/(dashboard)/marketplace/publish-form.tsx` — pick playbooks/skills, name, price
- `app/(dashboard)/marketplace/review-buttons.tsx` — approve/reject (super_admin)
- `app/api/marketplace/route.ts` (GET/POST), `app/api/marketplace/[id]/route.ts` (PATCH review)

## Data model (migration 030_bundles_marketplace.sql)
- `marketplace_listings` — manifest (jsonb), publisher_*, price_usd, revenue_share_pct (default 70),
  status (pending/approved/rejected), install_count, rating_sum/rating_count

## Gotchas
- Revenue share is **fields only** today — no Stripe payout wiring yet (future work).
- Listings RLS: approved visible to all; publishers see their own drafts.
