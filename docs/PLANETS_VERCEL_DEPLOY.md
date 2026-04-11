# Deploy Provenance planets (Vercel)

Planet apps live under `apps/` and share the **same Supabase project** as the main artworks app. Deploy each planet as its **own Vercel project** linked to this Git repository.

## Before you deploy

1. **Run Supabase migrations** (includes `collectibles`, `vehicles`, `properties`, `asset_events`, `certificates`, `api_keys`, `user_profiles.active_planets`). Use your normal process (`supabase db push`, hosted CI, etc.).
2. **Use Node 20.x** on Vercel for all projects (matches [VERCEL_DEPLOYMENT_GUIDE.md](../VERCEL_DEPLOYMENT_GUIDE.md) guidance for pnpm).

## Verify builds locally

From the **repository root**:

```bash
pnpm build:planets
```

This builds collectibles, real estate, vehicles, and the API app.

## Vercel: create one project per app

In [Vercel](https://vercel.com) → **Add New** → **Project** → import `timlefkowitz/provenance` (or your fork). Repeat for each row below so you end up with **four extra projects** (plus your existing main app if it is separate).

| Vercel project name (suggested) | Root Directory | Production domain (suggested) |
|---------------------------------|----------------|------------------------------|
| `provenance-collectibles`       | `apps/collectibles` | `collc.provenance.guru` |
| `provenance-realestate`         | `apps/realestate`   | `rest.provenance.guru` |
| `provenance-vehicles`           | `apps/vehicles`     | `auto.provenance.guru` |
| `provenance-api`                | `apps/api`          | `api.provenance.guru` |

### Build & install settings

Each app folder already contains a `vercel.json` that runs install/build from the **monorepo root** (so `workspace:*` resolves). On Vercel:

1. Open the project → **Settings** → **General** → **Root Directory** → set to the value in the table (e.g. `apps/collectibles`).
2. **Settings** → **General** → **Node.js Version** → `20.x`.
3. Under **Build & Development Settings**, leave **Framework Preset** as Next.js. Vercel should pick up `vercel.json` from the root directory; it defines:
   - `installCommand`: `cd ../.. && pnpm install --no-frozen-lockfile`
   - `buildCommand`: `cd ../.. && pnpm --filter @provenance/<package> build`
   - `outputDirectory`: `.next`

If the dashboard overrides these, align them with the app’s `vercel.json`.

### Environment variables (all planet UI projects)

Copy the same values you use for the main app, at minimum:

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |

Optional (recommended for clarity):

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_PLANET` | `collectibles`, `realestate`, or `vehicles` matching the app |

The collectibles / real estate / vehicles apps also **force** the correct planet in middleware, so they work even if this is omitted.

### Environment variables (`provenance-api` only)

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as above |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — required for API routes that bypass RLS |

### Domains & DNS

1. In each Vercel project → **Settings** → **Domains** → add the production host (e.g. `collc.provenance.guru`).
2. At your DNS host (e.g. GoDaddy), add the record Vercel shows (usually **CNAME** `collc` → `cname.vercel-dns.com` or similar).

Repeat per subdomain.

### Supabase Auth (when you add login to planet apps)

In Supabase → **Authentication** → **URL configuration**, add each planet origin to **Redirect URLs** and **Site URL** as needed (e.g. `https://collc.provenance.guru/**`). The main app uses `/auth/callback`; mirror that when you add auth routes to planet apps.

## Quick reference: package names for filters

| Directory | `pnpm --filter` name |
|-----------|----------------------|
| `apps/collectibles` | `@provenance/collectibles` |
| `apps/realestate` | `@provenance/realestate` |
| `apps/vehicles` | `@provenance/vehicles` |
| `apps/api` | `@provenance/api` |

## Troubleshooting

- **Build: “workspace:* not found”** — Root Directory must be the app folder (`apps/collectibles`, etc.) so `cd ../..` reaches the repo root where `pnpm-workspace.yaml` lives.
- **Runtime: Supabase errors** — Env vars missing or wrong project; API needs `SUPABASE_SERVICE_ROLE_KEY`.
- **Edge warnings about Supabase** — Known webpack warnings from middleware; build still succeeds.
