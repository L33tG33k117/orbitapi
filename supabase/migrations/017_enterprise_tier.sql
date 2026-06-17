-- Add enterprise to workspace_tier enum
alter type public.workspace_tier add value if not exists 'enterprise';
