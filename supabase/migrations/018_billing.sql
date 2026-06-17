-- Stripe billing fields on workspaces
alter table public.workspaces
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;

-- Index for fast Stripe webhook lookups
create index if not exists workspaces_stripe_customer_idx on public.workspaces (stripe_customer_id);
create index if not exists workspaces_stripe_sub_idx on public.workspaces (stripe_subscription_id);
