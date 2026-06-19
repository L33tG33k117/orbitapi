-- ============================================================
-- 039 — Capture diagnostics with beta feedback
-- ============================================================
-- Stores the page, any recent client-side errors, and browser/viewport context
-- alongside each feedback note so the team can act on it without a back-and-forth.
-- The API writes here when present and falls back to folding a summary into the
-- message text when this column hasn't been applied yet, so it's safe to deploy
-- the code before running this migration.

alter table public.feedback
  add column if not exists diagnostics jsonb;
