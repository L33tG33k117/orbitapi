-- The "for all using (true)" policy on memberships was a security bug:
-- the USING clause covers SELECT, so every authenticated user could read
-- every membership row. All membership writes now go through the
-- service-role admin client in API routes, so this policy is not needed.

drop policy if exists "Service can manage memberships" on public.memberships;
