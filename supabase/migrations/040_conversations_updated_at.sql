-- ============================================================
-- 040 — Ensure conversations.updated_at exists
-- ============================================================
-- The chat history list and the chat route sort/touch conversations by
-- updated_at, but an older schema (001) created the table without it, causing
-- "column conversations.updated_at does not exist" 500s and an empty history.
-- Adds the column idempotently and backfills from created_at.

alter table public.conversations
  add column if not exists updated_at timestamptz not null default now();

update public.conversations set updated_at = created_at where updated_at is null;
