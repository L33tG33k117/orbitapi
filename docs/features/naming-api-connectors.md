# Naming Convention — "API Connectors"

**Status:** Complete (live).

## Summary
User-facing copy says **"API Connectors" / "API connector"** (not bare "Connectors") for the
non-technical "API for dummies" audience. Routes, DB, and code identifiers stay `connectors`.

## Scope of the rename (user-facing only)
- Sidebar nav label, the API Connectors page heading + catalog (search/count/empty states),
  bundle content tags ("N API connectors"), dashboard, data-mapping, chat, API reference copy.
- Added a one-line definition on the page: "A connector is a ready-made link to an app's API."

## What stays `connectors` (do NOT rename)
- Routes: `/connectors`, `/api/connections`, etc.
- DB: `connectors` / `connections` tables.
- Code: `getConnector`, `ConnectorManifest`, `connectors/` directory, etc.

## STANDING RULE
Recorded in memory (`feedback_rami.md`): use "API Connectors" in any new user-facing copy.
