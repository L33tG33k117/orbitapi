-- ============================================================
-- 042 — Create the missing conversation_messages table
-- ============================================================
-- Symptom: Orbit Assistant history shows only the title / no messages — every
-- message save fails with: relation "public.conversation_messages" does not exist.
--
-- Cause: `conversations` was created back in migration 001 (without updated_at).
-- Migration 014 then tried to CREATE TABLE conversations a second time, which
-- collided and aborted 014 before it created `conversation_messages` — yet 014
-- was still recorded as applied. So the messages table never existed on this DB.
-- (The missing updated_at column was separately fixed in 040.)
--
-- Fix: create the table (idempotently) with its index + RLS, matching 014's
-- definition. The redundant updated_at trigger from 014 is intentionally NOT
-- recreated — the app bumps conversations.updated_at explicitly after each insert.

create table if not exists public.conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists conversation_messages_convo_created_idx
  on public.conversation_messages (conversation_id, created_at asc);

alter table public.conversation_messages enable row level security;

-- App access is via service-role API routes; this mirrors 014's intent so a
-- user can only ever read messages from their own conversations.
drop policy if exists "own conversation messages" on public.conversation_messages;
create policy "own conversation messages" on public.conversation_messages
  for all using (
    conversation_id in (select id from public.conversations where user_id = auth.uid())
  );
