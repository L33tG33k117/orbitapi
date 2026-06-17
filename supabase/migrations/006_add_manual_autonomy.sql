-- Add 'manual' as a valid autonomy value
alter table public.skills drop constraint if exists skills_autonomy_check;
alter table public.skills add constraint skills_autonomy_check
  check (autonomy in ('supervised', 'manual', 'autonomous'));
