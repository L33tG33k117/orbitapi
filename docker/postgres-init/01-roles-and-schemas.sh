#!/bin/bash
# ============================================================
# OrbitAPI self-hosted — database bootstrap
# ============================================================
# Runs ONCE, by the postgres image, on an empty data directory.
#
# Hosted Supabase provides these roles and schemas for you. Self-hosted
# Postgres does not, and the app's SQL assumes them: migrations reference
# auth.users, RLS policies key off the authenticated/anon roles, and PostgREST
# switches roles per request based on the JWT.
#
# This is a shell script rather than plain .sql so the `authenticator` login
# password can come from POSTGRES_PASSWORD without being written into a file
# that ends up in the image.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- gen_random_uuid() and digest(), used by migrations throughout.
  create extension if not exists pgcrypto;

  -- ----------------------------------------------------------
  -- Roles
  -- ----------------------------------------------------------
  -- anon           unauthenticated requests
  -- authenticated  a signed-in user; RLS policies key off this
  -- service_role   bypasses RLS; used by the app's admin client only
  -- authenticator  the role PostgREST connects as. It holds no privileges of
  --                its own and SET ROLEs into one of the above per request, so
  --                a forged or stale JWT can never exceed its own role.
  do \$\$
  begin
    if not exists (select from pg_roles where rolname = 'anon') then
      create role anon nologin noinherit;
    end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin noinherit;
    end if;
    if not exists (select from pg_roles where rolname = 'service_role') then
      create role service_role nologin noinherit bypassrls;
    end if;
  end
  \$\$;

  create role authenticator login noinherit password '${POSTGRES_PASSWORD}';
  grant anon, authenticated, service_role to authenticator;

  -- ----------------------------------------------------------
  -- Schemas
  -- ----------------------------------------------------------
  -- GoTrue creates and migrates \`auth\` itself, but the schema must exist and
  -- be writable by it before it starts.
  create schema if not exists auth;

  grant usage on schema public to anon, authenticated, service_role;
  grant usage, create on schema auth to service_role;
  grant usage on schema auth to anon, authenticated;

  -- So each future migration doesn't have to remember to grant.
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public
    grant execute on functions to anon, authenticated, service_role;

  -- auth.users is read by the app (joins on user_id), never written directly.
  alter default privileges in schema auth
    grant select on tables to authenticated, service_role;
EOSQL

echo "[orbit-db] roles, schemas and extensions created"
