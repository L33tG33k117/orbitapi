-- Creates a public RPC wrapper around vault.decrypted_secrets.
-- vault.decrypted_secrets is a VIEW (not a function), so it cannot be called
-- via admin.rpc() directly. This wrapper function runs with security definer
-- so it has vault access regardless of the calling role.
-- Safe to run even if the vault extension is not enabled — the DO block checks first.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'supabase_vault') then
    execute $func$
      create or replace function public.get_vault_secret(secret_id uuid)
      returns text
      language sql
      security definer
      set search_path = ''
      as $inner$
        select decrypted_secret
        from vault.decrypted_secrets
        where id = secret_id
        limit 1;
      $inner$;

      -- Only the service role should call this
      revoke all on function public.get_vault_secret(uuid) from public, anon, authenticated;
      grant execute on function public.get_vault_secret(uuid) to service_role;
    $func$;
  end if;
end $$;
