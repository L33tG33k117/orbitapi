# Foundation C — Bundle / Package Primitive

**Status:** Complete (live, migration 030 applied)

## Summary
One serialization format (`BundleManifest`) and one installer used by BOTH code-defined vertical
bundles (#7) and the community marketplace (#4). Installing a bundle provisions a complete, runnable
workspace slice — connections + groups + playbooks + skills — tagged so it can be uninstalled as a unit.

## How it works
- `BundleManifest` = `{ slug, name, description, category, version, connectors[], groups[], playbooks[], skills[] }`.
- `installBundle()` (idempotent per workspace+slug):
  1. resolves each connector slug → `connectors` row, creates a connection (simulated/demo, no creds)
  2. creates groups + wires `group_connections`
  3. creates playbooks (action steps reference `connector_slug`, remapped to the new connection_id)
  4. creates skills
  5. records a `bundle_installations` row with `created_resources` for clean uninstall
- `uninstallBundle()` removes exactly what was created (child-first).
- `exportBundle()` serializes existing workspace playbooks/skills into a manifest — **credentials are
  never exported**, only connector references.

## Key files
- `lib/bundles.ts` — `BundleManifest`, `installBundle`, `uninstallBundle`, `exportBundle`
- `lib/bundle-registry.ts` — code-defined vertical bundles (see vertical-bundles.md)

## Data model (migration 030_bundles_marketplace.sql)
- `marketplace_listings` — slug, kind, manifest (jsonb), publisher, price_usd, revenue_share_pct, status, install_count, ratings
- `bundle_installations` — workspace_id, bundle_slug, source, listing_id, created_resources (jsonb)
- RPC `increment_listing_installs`

## Gotchas
- Action steps in a manifest use `connector_slug` (connection ids don't exist until install) — the
  installer remaps these to real connection ids. `PlaybookNode.connector_slug` is the optional field.
- Bundle connections install as `active` but without credentials; security connectors need creds before
  their live action steps can fire (the playbooks/skills/personas are the land-and-expand value).
