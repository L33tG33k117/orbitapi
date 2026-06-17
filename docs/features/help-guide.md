# Help Guide (In-App)

**Status:** Complete (live).

## Summary
A user-facing Help Guide at `/guide` explaining every user section with what-it-is / when-to-use /
example + on-theme visual previews, a 3-step quickstart, and a sticky table of contents. No admin coverage.

## How it works
- Data-driven: a `SECTIONS[]` array (one entry per feature) renders anchored cards + a sticky TOC.
- Each entry: `{ id, title, icon, what, use, example, href?, preview? }`. `preview` is a styled
  representative mock (real screenshots can be dropped into the same slot later).

## Key files
- `app/(dashboard)/guide/page.tsx` — the `SECTIONS` array + rendering
- Nav: top section "Help Guide" (LifeBuoy icon)

## STANDING RULE
**Whenever a user-facing feature is added or changed, update its entry in `SECTIONS` in the same change.**
This is recorded in memory (`feedback_rami.md`). Treat the guide like docs that ship with the code.

## Gotchas
- Screenshots aren't real captures yet (styled previews stand in). They go in the `preview` field.
- Keep copy non-technical ("API for dummies" audience) and never expose model/vendor names.
