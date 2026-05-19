# Google Search Console — sitemaps & robots

Production SEO routes live in the **repo root** Next.js app (`src/app/sitemap.xml/route.ts`, `src/app/robots.txt/route.ts`), not under `makerkit/nextjs-saas-starter-kit-lite/apps/web/`.

## Correct URLs

| Purpose | URL |
|--------|-----|
| **Submit in GSC → Sitemaps** | `https://www.provenance.guru/sitemap.xml` |
| **Do not submit as a sitemap** | `https://www.provenance.guru/robots.txt` |
| **robots.txt (crawl rules only)** | `https://www.provenance.guru/robots.txt` |

`robots.txt` is plain text. If you add it under **Sitemaps**, Search Console reports **“Unsupported file format”** and **0 discovered pages** — that is expected.

Apex `https://provenance.guru/sitemap.xml` redirects (307) to `www`; prefer submitting the **www** URL above.

## Search Console cleanup (required once)

1. Open [Google Search Console](https://search.google.com/search-console) → your property (`https://www.provenance.guru/` or Domain `provenance.guru`).
2. Go to **Sitemaps**.
3. **Remove** any submitted sitemap whose path is `robots.txt`.
4. Ensure **only** this sitemap is submitted: `sitemap.xml` (full URL: `https://www.provenance.guru/sitemap.xml`).
5. Open the `sitemap.xml` row → **Validate** / request re-fetch if available.
6. Wait 24–72 hours. **Discovered pages** should approach **~20** (marketing routes + blog posts).

The **robots.txt** report showing “0 discovered pages” is normal; URL discovery comes from the XML sitemap, not from `robots.txt`.

## Environment (Vercel)

Set for Production:

```bash
NEXT_PUBLIC_SITE_URL=https://provenance.guru
# or https://www.provenance.guru
```

`getPublicSiteOrigin()` normalizes apex `provenance.guru` → `https://www.provenance.guru` in `<loc>` and in the `Sitemap:` line in `robots.txt`.

Also required for blog URLs in the sitemap:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

If Supabase env vars are missing, the sitemap still returns static routes (no blog post URLs).

## Verify production (local)

```bash
pnpm verify:seo
```

Or manually:

```bash
curl -sS -D - -o /dev/null https://www.provenance.guru/sitemap.xml | grep -i content-type
curl -sS https://www.provenance.guru/sitemap.xml | xmllint --noout -
curl -sS https://www.provenance.guru/robots.txt | grep -i '^Sitemap:'
```

Expected:

- `content-type: application/xml; charset=utf-8`
- Valid XML (`xmllint` exit 0)
- `Sitemap: https://www.provenance.guru/sitemap.xml`

## Redirects

`/sitemap` and `/sitemap/` redirect to `/sitemap.xml` (`next.config.ts`). Submit the `.xml` URL in Search Console.

## Creator subdomains

`*.provenance.app` creator sites are **not** included in the main sitemap. A separate sitemap strategy would be needed to index those.
