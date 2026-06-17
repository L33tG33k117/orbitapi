# #2 — AI Connector Schema Discovery

**Status:** Complete (live).

## Summary
Point Orbit at an unsupported API (OpenAPI spec URL, or just a name) and it introspects the schema
and proposes a connector manifest — actions with method/path/risk/inputs — ready to request as a build.

## How it works
- `/api/connectors/discover` fetches the OpenAPI/Swagger URL (truncated to bound tokens) and asks the
  model to extract proposed actions with honest risk classification (GET=read, create/update=write,
  delete/isolate/purge=destructive). Returns a draft `{ validated, actions[], auth }` — never writes code.
- The Discover page shows proposed actions; "Request this connector" hands off to the existing
  connector-requests pipeline (prefilled name + docs URL + action summary) for admin build.

## Key files
- `app/api/connectors/discover/route.ts` — fetch spec + AI extraction (admin only)
- `app/(dashboard)/connectors/discover/page.tsx`, `discover-client.tsx` — form + results + request handoff
- Nav: indented under "API Connectors" → "Discover"

## Gotchas
- If no spec is provided and the model can't confidently identify endpoints, it returns `validated:false`.
- This proposes a manifest; the actual code build still goes through `lib/build-connector.ts` / admin apply.
