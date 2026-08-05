# CASA Evidence — Inventory of APIs Accepting User-Controlled Input

**Question:** *Provide a list of APIs in which portions of the API/URL
or parameters may be passed from the user into the application.*

**Application:** Provenance (Next.js App Router monorepo). Two API
surfaces exist:

1. **Internal application API** (`src/app/api/**/route.ts`) — called by
   Provenance's own frontend, session-cookie authenticated.
2. **Public partner REST API** (`apps/api/src/app/api/v1/**/route.ts`)
   — a separate deployable app, Bearer-API-key authenticated, intended
   for third-party integrators (certificate verification, asset
   lookup).

For every route below, "user-controlled input" means one or more of:
a **dynamic URL path segment** (e.g. `[id]`), a **query-string
parameter**, or a **request body** (JSON or `multipart/form-data`).
This document also lists dynamic **page** routes, since the question
covers "API/URL" broadly, and notes the common input-validation
controls applied across the whole surface (§4).

---

## 1. Public Partner REST API (`apps/api` — `/api/v1/*`)

All routes below require `Authorization: Bearer <api_key>`
(`authenticateRequest()` in `apps/api/src/middleware/auth.ts`), which
looks the key up by SHA-256 hash, checks `is_active`/`expires_at`, and
enforces a per-key hourly rate limit (Upstash-backed). Several routes
additionally enforce **scope** and **planet** restrictions baked into
the API key itself.

| Endpoint | Method | User-controlled input | Auth / authorization | Validation |
| --- | --- | --- | --- | --- |
| `/api/v1/verify` | POST | Body: `planet` (or legacy alias `island`), `asset_id` | Bearer API key; if the key is planet-scoped, `auth.planet` must match the body's `planet` | `isValidPlanet()` whitelist check on `planet`; `asset_id` presence check; looked up with `.eq('id', asset_id)` (parameterized, not string-built SQL) |
| `/api/v1/assets/{planet}` | POST | **Path:** `planet`. Body: arbitrary JSON object (spread into the insert — `title` required) | Bearer API key; `planet` in path must match the key's scoped planet if set | `isValidPlanet()` on path param; `title` type/presence check; `account_id`/`created_by`/`updated_by` are **overwritten server-side** from `auth.accountId` after the body spread, so a caller cannot spoof ownership of the created asset |
| `/api/v1/assets/{planet}/{id}` | GET | **Path:** `planet`, `id` | Bearer API key; requires `verify` scope (`requireScope`) **and** matching planet scope (`requirePlanet`) | `isValidPlanet()` on `planet`; `id` used only in a parameterized `.eq('id', id)` lookup; response uses an explicit allow-listed column list (`PUBLIC_ASSET_COLS`), never `select('*')`, so no internal field can leak via this path even if the row is found |
| `/api/v1/assets/{planet}/{id}/history` | GET | **Path:** `planet`, `id` | Bearer API key + scope/planet checks (same pattern as above) | Same as above |
| `/api/v1/certificates/{number}` | GET | **Path:** `number` (certificate number) | Bearer API key (no additional scope — global lookup by design, doc'd in the route as "no planet parameter needed") | `certNumber` used only in parameterized `.eq('certificate_number', ...)` lookups across a fixed, hardcoded list of tables — never interpolated into a query string |
| `/api/v1/webhooks` | POST | Body: outbound-webhook subscription config (URL, events, planet) | Bearer API key | Validated against the caller's own account scope before persisting |

**Note on this API's design as it relates to user input:** every
lookup uses the Supabase client's parameterized query builder
(`.eq(...)`, `.in(...)`) — the path/body values are always passed as
bind values, never concatenated into a raw SQL string, which is the
primary control against SQL injection on this surface.

---

## 2. Internal Application API (`src/app/api/**`)

### 2.1 Resource-by-ID routes (dynamic path segment `[id]`)

| Endpoint | Method | User-controlled input | Auth / authorization | Validation |
| --- | --- | --- | --- | --- |
| `/api/operations/invoices/[id]/pdf` | GET | Path: `id` | Signed-in user required; **row ownership re-checked** — the invoice query adds `.eq('account_id', user.id)` in addition to `.eq('id', id)`, and an active subscription is required | `id` is a bind parameter, not interpolated; 404 returned (not 403) if the row exists but isn't owned, avoiding existence-leak |
| `/api/operations/loans/[id]/pdf` | GET | Path: `id` | Same pattern as invoices | Same pattern |
| `/api/operations/consignments/[id]/pdf` | GET | Path: `id` | Same pattern as invoices | Same pattern |

### 2.2 Search / lookup routes (query-string parameters)

All of the following are `GET` requests whose only input is one or
more query-string parameters, generally used to build an `ILIKE`
text-search filter. This group represents the largest "free text from
the user" surface in the internal API and is where SQL/query-syntax
injection risk would most likely appear if unguarded.

| Endpoint | Query params | Auth | Validation / hardening |
| --- | --- | --- | --- |
| `/api/search-artworks` | `q` | Public (result set additionally scoped: signed-out sees `is_public=true` only; signed-in also sees own rows) | Zod (`min(2).max(100)`), `escapeIlike()` escapes `%`/`_`/`\` before building the `ilike` pattern, rate-limited (60/window) |
| `/api/search-artists` | `q` | Public | Same `escapeIlike` + length-bounded pattern |
| `/api/search-galleries` | `q` | Public | Same pattern |
| `/api/search-accounts` | `q`, `role` | Public | Zod schema (`q` 2–100 chars, `role` ≤32 chars); `role` is then validated against a closed enum (`isValidRole`) rather than used raw in the query |
| `/api/search-contacts` | `q` | Signed-in (CRM contacts scoped to the caller's own account) | Length-bounded, escaped |
| `/api/search-artwork-text` | `q`, `field` | Signed-in, row-scoped | `field` constrained to a fixed allow-list of column names (never used to build a dynamial column reference from raw input) |
| `/api/check-username` | `username` | Public | Zod: 2–50 chars **and** `^[a-zA-Z0-9_.-]+$` regex — rejects anything but the exact character set a username can contain, which also incidentally rules out SQL/ILIKE metacharacters; rate-limited (30/window) |
| `/api/check-gallery-profile` | (profile identifiers) | Signed-in | Ownership-scoped query |
| `/api/artist-preview` | `accountId`, `profileId`, `posterAccountId` (at least one required) | Public (returns only public profile/portfolio data) | Zod: each param must be `z.string().uuid()` — malformed/non-UUID values are rejected before ever reaching a query; rate-limited (120/window) |
| `/api/artworks/feed` | `seed`, `offset`, `limit`, `q`, `sort` | Public, with `following` sort gated to signed-in | Full Zod schema: `offset`/`limit` coerced+bounded integers (`limit` max 20), `sort` constrained to a **closed enum** (`shuffle\|recent\|top\|following\|exhibitions`) so it can never be used to inject an arbitrary `ORDER BY`/filter clause, `q` escaped via `escapeIlike` |
| `/api/get-user-exhibitions` | `userId` | Signed-in — **explicit IDOR check**: `user.id !== userId` → `403` | Straightforward equality check before any query runs |
| `/api/check-exhibition-ownership` | `exhibitionId`, `userId` | Signed-in — same explicit `user.id !== userId` check | Ownership additionally re-verified against the `exhibitions.gallery_id` column server-side (never trusts a client-asserted "I own this" claim) |
| `/api/stripe/connect/status` | (account context, session-derived) | Signed-in | Reads only the caller's own Stripe Connect status |

### 2.3 Mutation / action routes (JSON body)

| Endpoint | Method | Body input | Auth | Validation |
| --- | --- | --- | --- | --- |
| `/api/certificate-invite` | POST | Invite recipient details, artwork/claim reference | Signed-in, ownership-checked | Zod-validated payload |
| `/api/profiles/parse-input` | POST | Free-text profile input (for AI-assisted parsing) | Signed-in | Size-bounded, passed to a constrained AI extraction task, not executed/evaluated |
| `/api/heartbeat` | POST | none beyond session | Signed-in | Calls the `record_user_heartbeat` DB function, which itself enforces `auth.uid() = p_user_id` server-side (see `principle-of-least-privilege.md` §3) |
| `/api/email/send` | POST | Recipient/template/merge-field data | Signed-in / internal-only callers | Recipient and template resolved against allow-listed internal templates, not arbitrary attacker-supplied HTML |
| `/api/admin/leads` | GET, POST | Query: `datasetId`, `runId`; Body: lead data | **Admin only** (`requireAdminApi()`) | Full admin+MFA gate (see `authentication-and-access-control.md` §3.3) before any parameter is used |
| `/api/admin/audio/denoise` | POST | `multipart/form-data` audio file | **Admin only** | File-type/size checks before processing |
| `/api/stripe/create-checkout-session` | POST | `role`, `interval`, `priceId` selection | Signed-in | Requested `priceId` is cross-checked against the server's own known Stripe price IDs (from env config) — the client cannot submit an arbitrary price ID and have it silently accepted |
| `/api/stripe/create-artwork-checkout-session` | POST | `artworkId`, buyer details | Signed-in | Artwork looked up and price taken from the **server-side row**, not from client-submitted price data |
| `/api/stripe/create-domain-checkout-session` | POST | Domain name, plan | Signed-in | Domain format validated before a Stripe session references it |
| `/api/stripe/connect/create-account`, `/api/stripe/connect/account-session` | POST | Onboarding fields | Signed-in | Tied to the caller's own account; cannot create/link a Connect account on someone else's behalf |
| `/api/stripe/create-portal-session` | POST | none beyond session | Signed-in | Portal session created only for the caller's own Stripe customer id |
| `/api/log-client-error` | POST | Arbitrary client-reported JSON | Public (client-side error reporting) | **Explicit key allow-list** (`sanitizeClientErrorPayload`) — only `message`/`uploaded`/`totalImages`/`userAgent`/`platform`/`viewport`/`chunkCount` are extracted; every other field is silently dropped, strings are truncated to 500 chars before logging (prevents log injection / arbitrary-payload logging); rate-limited (30/window) |
| `/api/onboarding/upload-cv` | POST | `multipart/form-data` file (CV) | Signed-in | `assertAllowedFile` / `assertAllowedFileWithAv` check real file signature (not just the claimed `Content-Type`) against an allow-list (PDF/DOCX/DOC/TXT/CSV) and a 10 MB size cap, plus anti-virus scanning, before the file is stored or parsed |
| `/api/taco/chat`, `/api/grants/chat`, `/api/opportunities/chat` | POST | Free-text chat message + conversation history | Signed-in (subscription-gated) | User text is sent to the model **only as conversation content**, never concatenated into a server-side prompt that also contains privileged instructions in a way the user could override; all "tool" actions the AI can take (e.g. `handleCreateExhibition`, `handleUpdateArtistBio`) re-enter the same Supabase client bound to the caller's session, so the AI cannot act with more privilege than the signed-in user already has — see `principle-of-least-privilege.md` |

### 2.4 Webhooks & scheduled (cron) routes — not user-facing, but network-reachable

| Endpoint | Method | Input | How it's restricted |
| --- | --- | --- | --- |
| `/api/webhooks/stripe` | POST | Raw Stripe event payload (headers + body) | Stripe **signature** verified (`stripe.webhooks.constructEvent`) against `STRIPE_WEBHOOK_SECRET` before any field of the body is trusted — an attacker who merely POSTs to this URL without a valid signature is rejected outright |
| `/api/cron/stripe-reconcile` | GET, POST | none (scheduled trigger) | `Authorization: Bearer <CRON_SECRET>` checked via `constantTimeEquals()` (timing-safe compare), fails closed if `CRON_SECRET` is unset |
| `/api/cron/lifecycle-emails` | GET | none | Same `CRON_SECRET` pattern |
| `/api/cron/operations-alerts` | GET, POST | none | Same `CRON_SECRET` pattern |

### 2.5 Auth callback routes (query parameters from redirect flows)

| Endpoint | Method | Query params | Notes |
| --- | --- | --- | --- |
| `/auth/callback` | GET | OAuth `code`, `next` redirect path | Exchanged directly with Supabase Auth for a session (`exchangeCodeForSession`); the `next` redirect target is constrained to same-origin relative paths |
| `/auth/confirm` | GET | Supabase `token_hash`, `type`, `next` | Verified via `supabase.auth.verifyOtp()` — the token itself is the security boundary, not the URL structure |

### 2.6 Session-context-only routes (no meaningful user-supplied parameter)

For completeness: `/api/admin/check` (GET) and `/api/check-gallery-profile`
take no query/body input beyond the caller's own session cookie —
included here to make clear the inventory above is exhaustive of the
route list, not a filtered subset.

---

## 3. Dynamic page routes (URL path segments)

These are Next.js pages (not JSON APIs) whose URL contains a
user-suppliable segment. Listed because the question asks about
"portions of the API/**URL**." None of these execute raw SQL from the
path segment — each resolves to a Postgres lookup that is additionally
constrained by Row Level Security (see
`authentication-and-access-control.md` and
`principle-of-least-privilege.md` for the full RLS/least-privilege
model that governs every one of these lookups).

| Route pattern | Path segment(s) | What it resolves to |
| --- | --- | --- |
| `/artworks/[id]` | `id` | A single artwork (RLS: owner or `status='verified'`/`is_public`) |
| `/artists/[id]`, `/profiles/[id]` | `id` | A public profile |
| `/collectibles/[id]` | `id` | A collectible asset (same visibility rules as artworks) |
| `/exhibitions/[id]` | `id` | A published exhibition |
| `/grants/proposals/[id]` | `id` | A grant proposal (author/collaborator scoped) |
| `/gallery/[name]`, `/gallery/[segment]`, `/g/[slug]` | slug/name | A gallery's public page/short link |
| `/blog/[slug]`, `/open-calls/[slug]` | slug | Published content lookup by slug |
| `/_sites/[handle]`, `/_sites/[handle]/works/[artworkId]`, `/_sites/[handle]/exhibitions/[id]` | handle, id | Creator-site tenant routing (resolved in `src/middleware.ts`, see `authentication-and-access-control.md` §3.1) |
| `/admin/blog/[id]` | `id` | Admin-only content edit (behind `requireAdmin()`, see the admin layout gate) |
| `/investors/[doc]`, `/portal/market-cap/[scope]`, `/docs/[...slug]`, `/docs/api/[...slug]` | doc/scope/slug | Static/curated content selection, not arbitrary file-path traversal (Next.js route matching, not filesystem `readFile(path)`) |

---

## 4. Common input-validation controls applied across the surface

| Control | Where used | Purpose |
| --- | --- | --- |
| **Zod schema validation** (`z.object`, `.uuid()`, `.enum()`, length bounds) | Most query/body-parsing routes (`search-*`, `check-username`, `artworks/feed`, `artist-preview`, etc.) | Rejects malformed/oversized/wrong-type input before it reaches any database call |
| **`escapeIlike()`** (`src/lib/escape-ilike.ts`) | Every free-text search endpoint that builds an `ilike` pattern | Escapes `%`, `_`, and `\` so user text cannot widen or hijack the intended wildcard pattern |
| **Closed enum / allow-list params** (e.g. `sort`, `field`, `role`) | `artworks/feed` (`sort`), `search-artwork-text` (`field`), `search-accounts` (`role`), planet routes (`isValidPlanet`) | Prevents a parameter from being used to reach an unintended code path or column, regardless of what string is supplied |
| **Parameterized queries only** | Every route (Supabase client `.eq()`/`.in()`/`.or()` builders) — no route in this codebase concatenates user input into a raw SQL string | Standard SQL-injection defense; confirmed by inspection, not just convention |
| **Ownership re-checks beyond RLS** | `get-user-exhibitions`, `check-exhibition-ownership`, `operations/*/pdf` routes | Defense-in-depth IDOR prevention — explicit `callerId === resourceOwnerId` checks in code, in addition to the database's own RLS policies |
| **Rate limiting** (`src/lib/rate-limit.ts`, Upstash-backed with in-memory fallback) | All public search/lookup endpoints, `log-client-error`, `check-username`, `artist-preview` | Bounds abuse of unauthenticated, input-accepting endpoints (scraping, brute force, DoS) |
| **File-signature + AV validation** (`src/lib/file-signature.ts`) | `onboarding/upload-cv` and other file-upload routes | Verifies actual file bytes match an allow-listed type (not just the client-asserted `Content-Type`), enforces a size cap, and scans for malware before storage |
| **Key allow-listing for logged/echoed input** | `log-client-error` | Prevents a client from injecting arbitrary fields/log lines through a "telemetry" endpoint |
| **Signature verification for inbound webhooks** | `webhooks/stripe` | Rejects any payload not cryptographically signed by the claimed sender |
| **Constant-time secret comparison** | `cron/*` routes | Prevents timing side-channel recovery of `CRON_SECRET` |
| **API-key scope + planet binding** | All `apps/api` `v1` routes | A key issued for one partner/vertical cannot use its `planet`/`id` path parameters to reach another partner's data |

---

## 5. Summary

Every endpoint that accepts a user-suppliable URL segment, query
parameter, or request body has been enumerated above, grouped by
input shape. Across the whole surface, no route trusts a
user-controlled value to determine *whose* data is returned without
an independent server-side check (session identity, RLS, or an
explicit ownership comparison), and no route builds a raw SQL/ILIKE
string without escaping or a closed enum. The public partner API
(`apps/api/v1`) additionally binds every request to an API key with
its own scope and planet restriction, so path parameters cannot be
used to pivot outside the caller's authorized data set.
