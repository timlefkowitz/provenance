# Creator Websites — Deploy Checklist

Before enabling creator websites in production, complete the following one-time infrastructure steps.

## 1. Wildcard subdomain on Vercel

Add `*.provenance.app` as a custom domain on the Vercel project:

1. Go to **Vercel → Project → Settings → Domains**
2. Add `*.provenance.app`
3. In your DNS provider (e.g. Cloudflare), add a CNAME record:
   - Name: `*`
   - Value: `cname.vercel-dns.com`
4. Vercel automatically provisions a wildcard TLS certificate via Let's Encrypt.

> **Note:** `www.provenance.app` and the apex `provenance.app` must remain as separate A/CNAME records — the wildcard `*` only matches one level of subdomain (i.e. `handle.provenance.app`, not `a.b.provenance.app`).

## 2. Run the database migrations

Apply all migrations to your production Supabase project:

- `20260513000000_profile_sites.sql` — base `profile_sites` table & RLS
- `20260514000000_profile_sites_extra.sql` — adds `hero_image_url`, `tagline`, `about_override`, `surface_color`, `artwork_filters`
- `20260515000000_profile_sites_delete_policy.sql` — adds the missing RLS DELETE policy (required for the Transfer / Remove handle actions to work)

```sh
supabase db push --linked
```

Or run the SQL directly in the Supabase SQL editor. The second migration is purely additive (uses `add column if not exists`) and safe to re-run.

## 3. Environment variables

No new env vars are required for v1. The middleware reads `NEXT_PUBLIC_SITE_URL` to derive the main hostname; ensure this is set to `https://provenance.app` in production.

For **v1.5 (custom domains)**, add:
- `VERCEL_API_TOKEN` — a Vercel personal access token with `projects:write` scope
- `VERCEL_PROJECT_ID` — the Vercel project ID (find in project Settings → General)
- `STRIPE_PRICE_CUSTOM_DOMAIN_MONTHLY` — new Stripe Price ID for the custom-domain add-on
- `STRIPE_PRICE_CUSTOM_DOMAIN_YEARLY` — yearly variant

## 4. (v1.5) Custom domain flow

When a user submits a custom domain:
1. Front-end calls `attachCustomDomainAction(profileId, domain)` (server action)
2. Action calls `POST https://api.vercel.com/v10/projects/{VERCEL_PROJECT_ID}/domains` with `{ name: domain }`
3. Instructions UI shows the CNAME to point at `cname.vercel-dns.com`
4. Background polling action calls `GET /v10/projects/{id}/domains/{name}` until `verified === true`, then sets `custom_domain_verified_at`
5. Middleware already falls through to custom domain lookup after subdomain check
