-- ============================================================
-- 053 — AI provider settings (bring-your-own LLM)
-- ============================================================
-- Phase 1 of the offline / self-hosted edition. An air-gapped customer can't
-- reach Anthropic, so they point Orbit at a model running on their own
-- hardware (Ollama, LM Studio, vLLM — all speak the OpenAI-compatible API).
--
-- One row per workspace, absent for everyone on the hosted product. No row
-- means "use Claude", so the cloud behaves exactly as it did before this
-- table existed.
--
-- Read through the service role by lib/ai-provider.ts, which ALSO re-checks
-- the `byo_llm` capability before honouring a row — a downgrade must stop the
-- local provider immediately, not whenever someone next opens settings.

create table if not exists ai_provider_settings (
  workspace_id      uuid primary key references workspaces(id) on delete cascade,

  -- Lets an admin switch back to Claude (cloud) or park a config without
  -- retyping the endpoint. Deleting the row would lose the API key too.
  enabled           boolean not null default true,

  -- Base URL of the OpenAI-compatible endpoint, e.g. http://192.168.1.50:11434/v1
  base_url          text not null,

  -- The single model served there, e.g. 'llama3.1:70b'. Recorded on runs as
  -- `local:<model_name>` so cost math resolves it to $0.
  model_name        text not null,

  -- Optional: most local servers don't authenticate, but some sit behind a
  -- reverse proxy that does. Stored via lib/credentials.ts (Vault, or the
  -- inline fallback) — never the raw key in this column.
  api_key_secret_id text,

  -- Output ceiling for this model. Orbit's agentic budget is 32k, which most
  -- local models cannot honour; null falls back to a conservative default.
  max_output_tokens integer check (max_output_tokens is null or max_output_tokens > 0),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table ai_provider_settings enable row level security;

-- No policies: written and read exclusively through the service role, behind
-- an admin-only API route. RLS on with zero policies keeps the anon and
-- authenticated keys away from the endpoint address entirely.
