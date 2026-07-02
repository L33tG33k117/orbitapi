-- MCP (Model Context Protocol) endpoints: one tokened URL per workspace that
-- lets external AI assistants (Claude, ChatGPT, Cursor) drive the workspace's
-- connectors through Orbit's risk gates. Reads execute directly; write and
-- destructive actions queue in pending_actions exactly like skill approvals.

create table public.mcp_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- Unguessable path segment: POST /api/mcp/{token}
  token text not null unique,
  enabled boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  last_used_at timestamptz,
  unique (workspace_id)
);

alter table public.mcp_endpoints enable row level security;

-- Members can see whether an endpoint exists; only service role writes.
create policy "mcp_endpoints_select" on public.mcp_endpoints
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
