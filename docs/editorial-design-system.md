# Editorial Design System ("Guru Overhaul")

Source: `Guru Overhaul 2` (Lovable-generated redesign concept of Provenance, TanStack Start + Tailwind v4). First applied to the site navbar in [`src/components/navigation.tsx`](../src/components/navigation.tsx).

Tokens already live in [`src/app/globals.css`](../src/app/globals.css) under the `/* Editorial palette (Guru Overhaul) */` block — this doc explains what they're for and how to use them elsewhere in the platform.

## Color tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `bone` | `oklch(0.965 0.012 85)` | `oklch(0.155 0.008 60)` | Page/surface background |
| `cream` | `oklch(0.94 0.02 82)` | `oklch(0.205 0.012 65)` | Secondary surface (cards, subtle fills) |
| `editorial-ink` | `oklch(0.14 0.01 60)` | `oklch(0.955 0.012 85)` | Primary text / dark fills (buttons, avatars) |
| `vermillion` | `oklch(0.62 0.22 32)` | `oklch(0.70 0.20 32)` | Accent — links/hover, active states, CTA hover, icons |
| `oxblood` | `oklch(0.38 0.12 25)` | `oklch(0.55 0.15 25)` | Secondary accent (deeper red, used sparingly) |
| `gilt` | `oklch(0.78 0.13 82)` | `oklch(0.82 0.14 82)` | Muted gold — index numbers, section eyebrows/labels |
| `editorial-border` | `oklch(0.2 0.01 60)` | `oklch(0.88 0.01 80)` | Hairline borders/dividers |

All flip automatically under `.dark`. Use Tailwind utilities directly: `bg-bone`, `text-editorial-ink`, `text-vermillion`, `border-editorial-border`, etc. Don't reuse the legacy `wine` / `parchment` / `ink` tokens in new editorial-styled UI — those are the old marketing palette.

## Typography

| Font | Tailwind utility | Use |
|---|---|---|
| Fraunces (serif) | `font-fraunces` | Display headings, wordmark, large body links — typically `italic` |
| JetBrains Mono | `font-jetbrains` | Nav labels, eyebrows, index numbers, buttons — always `uppercase tracking-[0.14em]`–`tracking-[0.2em]` |
| Inter Tight | `font-inter-tight` | Body copy alternative (not yet wired to `body` — currently Gotham stays default) |

Headings still default to Gotham site-wide; Fraunces is opt-in per-component for now (don't change global `body`/`h1–h6` font-family without a separate decision — that's a bigger change than the navbar).

## Shape & spacing

- **`--radius: 0` in the mockup** — sharp corners everywhere, no `rounded-*`. Applied via `rounded-none` on buttons/dropdowns/cards in migrated components (shared `@kit/ui` primitives like `Button`/`DropdownMenuContent` still default to rounded — override with `className="rounded-none ..."` per instance, don't change the shared component).
- Hairline borders/dividers: `hairline` / `hairline-b` / `hairline-r` / `hairline-l` utilities (1px, `editorial-border` color) instead of `border` + a color class.
- `label-editorial` utility: mono, uppercase, `0.7rem`, `0.18em` tracking — shorthand for the small caption/eyebrow style.
- `display-mega` utility: huge italic Fraunces, tight negative tracking, `line-height: 0.82` — for hero-scale display type.

## Motion / flourishes

- `pulse-dot` utility — 2s opacity pulse, for "live" indicators.
- `.grain::before` — fixed full-viewport SVG noise overlay, animated, `mix-blend-mode: multiply`. Subtle film-grain texture; apply the `grain` class to a page-level wrapper, not per-component.
- `marquee-track` (mockup only, not yet ported to the main app) — infinite horizontal scroll for ticker/marquee bands.

## Navbar-specific pattern (see `navigation.tsx`)

- Top-level nav links and dropdown triggers are prefixed with a small `gilt`-colored two-digit index (`01`, `02`, …) in `font-jetbrains text-[9px]`, numbered in display order. When a link's visibility is conditional (e.g. only when signed in), later indices shift — see `infoIndex` in `navigation.tsx` for the pattern (`Info` is `06` signed-in, `03` signed-out).
- Link/trigger hover state: color transitions to `vermillion` + an animated underline (`::after`, scales from `w-0` to `w-full`), not a background fill.
- Primary CTAs (`Add Artwork`, `Sign Up`): `bg-editorial-ink text-bone hover:bg-vermillion`, sharp corners, mono uppercase label.
- Secondary/ghost actions (`Log In`): no fill, `text-editorial-ink hover:text-vermillion hover:bg-vermillion/10`.

## What did *not* migrate (scope note)

The navbar migration only changed visual tokens (color/type/radius) — it did not add the mockup's decorative flourishes that aren't functional nav items: the live UTC clock, "Live node" pulse indicator, or dark-mode toggle button. Those exist in the `Guru Overhaul 2` mockup nav but weren't part of the current app's navbar, so they were left out per "keep everything the current navbar has, just restyle it." Revisit if the platform wants them added as new features.
