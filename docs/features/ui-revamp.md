# UI Revamp — Orbit/Space Theme

**Status:** Complete (live).

## Summary
A 2026 "deep space" visual refresh and a decluttered, grouped sidebar. Token-driven, so the palette
cascades to every page.

## How it works
- **Design tokens** in `app/globals.css` are the single source — deep-space indigo→violet palette
  (oklch), with `--brand-from` / `--brand-to` gradient stops. Edit tokens to restyle globally.
- **Utilities:** `.text-gradient` (brand gradient text — logos/hero only), `.orbit-glow` (CTA glow),
  `.glass` (frosted panel), `.orbit-stars` (faint starfield + nebula, used on the sidebar).
- **Fonts fixed:** the theme referenced `--font-sans`/`--font-geist-mono` but layout defined a different
  var, so the custom font wasn't loading. `app/layout.tsx` now loads Geist→`--font-sans` and
  Geist_Mono→`--font-geist-mono`.
- **Sidebar** (`components/sidebar.tsx`) regrouped into sections (Connect / Automate / Operate /
  Insights + Settings + Super Admin) using Tailwind sidebar tokens; active = gradient pill + glow bar.
- **Theme toggle** (`components/theme-toggle.tsx`) in the TopBar; **default theme is `dark`** (the hero
  look) in `components/theme-provider.tsx`. Sidebar is always dark.

## Key files
- `app/globals.css`, `app/layout.tsx`, `components/sidebar.tsx`, `components/top-bar.tsx`,
  `components/theme-toggle.tsx`, `components/theme-provider.tsx`

## Gotchas
- Sidebar uses `bg-sidebar-accent` etc. (mapped in `@theme inline`) — keep those tokens defined.
- Don't reintroduce model/vendor names in UI (see ai-power.md).
