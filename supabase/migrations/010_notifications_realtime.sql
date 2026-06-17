-- Enable Realtime for notifications so the bell updates live without polling
alter publication supabase_realtime add table public.notifications;
