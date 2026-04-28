# Working in this repo (LLM playbook)

This file is the source of truth for AI assistants (Cursor, Claude Code, Codex,
v0, Copilot Chat, etc.) working in **provence-app** — the Provenance art /
authentication / certificates platform.

Read this **before** writing or editing code. The codebase is large (~450
route+action files) and follows strong conventions that produce predictable PRs
when followed and noisy diffs when not.

`.cursor/rules/*.mdc` are still authoritative for the rules they cover
(logging, migrations) — this file extends them and never contradicts them.

---

## 1. What this project is

- **Provenance** — a journal of art, objects, and their histories. Verified
  COAs/COOs/COSs, exhibitions, gallery profiles, certificate claims, and a
  multi-planet (`artworks`, `collectibles`, `realestate`, `vehicles`)
  architecture sharing one Supabase backend.
- **App entry**: `src/app/...` (Next.js 15, App Router, RSC by default).
- **Deploy target**: Vercel. The default planet is `artworks` (the root app);
  `apps/collectibles`, `apps/realestate`, `apps/vehicles`, `apps/api` are
  scoped subdomain deployments that consume the same `@provenance/*` and
  `@kit/*` workspace packages.

## 2. Tech stack at a glance

| Concern        | Choice                                                                |
| -------------- | --------------------------------------------------------------------- |
| Framework      | Next.js 15 (App Router, Server Components, Server Actions)            |
| Runtime        | Node — never `runtime = 'edge'` for AI routes                         |
| Language       | TypeScript strict, React 19                                           |
| Styling        | Tailwind CSS v4 (`@theme` in `src/styles/theme.css`)                  |
| UI primitives  | `@kit/ui/*` (shadcn-style, in the makerkit workspace)                 |
| Data           | Supabase (Postgres + Auth + Storage)                                  |
| Auth           | Supabase Auth (`@kit/supabase/server-client`)                         |
| Payments       | Stripe (Checkout + portal; webhook at `src/app/api/webhooks/stripe`)  |
| Email          | Resend, optional (`isEmailConfigured()` no-ops without `RESEND_API_KEY`) |
| AI             | **AI SDK 6** via the Vercel AI Gateway (`'openai/gpt-4o-mini'` strings) |
| Package mgr    | **pnpm 10** workspace (`.npmrc` has `ignore-workspace-root-check=true`) |
| State (client) | React Query, SWR for ad-hoc fetches, sonner for toasts                |

## 3. Repo layout

```
.
├── src/                                  ← THE deployable app (root planet: artworks)
│   ├── app/                              ← App Router routes
│   │   ├── (route)/_components/          ← route-private UI
│   │   ├── (route)/_actions/             ← route-private 'use server' actions
│   │   ├── (route)/_hooks/               ← route-private hooks
│   │   ├── api/<endpoint>/route.ts       ← Route Handlers (REST)
│   │   ├── admin/                        ← gated by `requireAdmin()`
│   │   ├── feedback/                     ← public ticket submission
│   │   └── layout.tsx                    ← global providers + trackers
│   ├── components/                       ← cross-route components
│   ├── lib/                              ← server-safe utilities & services
│   └── styles/                           ← theme.css, theme.utilities.css, shadcn-ui.css
├── apps/                                 ← per-planet deployments (subdomains)
│   ├── api/  collectibles/  realestate/  vehicles/
├── packages/                             ← (currently used via makerkit/)
├── makerkit/nextjs-saas-starter-kit-lite/ ← upstream MakerKit, source of @kit/* + @provenance/*
│   ├── apps/web/supabase/migrations/     ← canonical Supabase migrations live HERE
│   └── packages/                         ← @kit/ui, @kit/supabase, @kit/auth, @kit/i18n, @kit/next, ...
├── scripts/                              ← one-off SQL + node scripts (NOT migrations)
└── .cursor/rules/                        ← *.mdc rules (logging, data-safe migrations)
```

> Important: `src/` **is** the root deployable. `apps/web/...` inside makerkit
> is the upstream reference; do not edit it unless you are updating the kit.

## 4. Path aliases

Set in `tsconfig.json`:

- `~/*` → `./src/*`  ← prefer this for app code
- `@/*` → `./src/*`  ← legacy alias, treat as a synonym

Workspace packages (resolved via pnpm-workspace, transpiled via
`transpilePackages` in `next.config.ts`):

- `@kit/ui`, `@kit/supabase`, `@kit/auth`, `@kit/accounts`, `@kit/i18n`,
  `@kit/next`, `@kit/shared`
- `@provenance/core`, `@provenance/planet-artworks`,
  `@provenance/verification-engine`

**Always import from these aliases** rather than relative paths that climb
into `makerkit/`. Example:

```ts
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardHeader, CardTitle } from '@kit/ui/card';
import { createNotification } from '~/lib/notifications';
```

## 5. Folder & file conventions

- **Colocation**: a route owns its UI (`_components/`), its server actions
  (`_actions/`), and its hooks (`_hooks/`). The `_` prefix opts the directory
  out of routing.
- **One server action per file** in most cases; export a single named function
  that mirrors the filename (`create-profile.ts` exports `createProfile`).
- **`'use server'` at the top** of every Server Action file. **`'use client'`**
  for components that use hooks/state/effects.
- **Page files (`page.tsx`) stay slim**: auth check + data fetch + render a
  `_components/` element. Heavy UI lives in components.
- **Naming**: kebab-case for filenames (`feedback-form.tsx`), PascalCase for
  components, camelCase for functions, `SCREAMING_SNAKE` for constants.
- **Component file = single default-or-named component** plus its private
  helpers; if a helper grows, lift it to `~/lib`.

## 6. Supabase clients — pick the right one

Three clients, three uses:

| Helper                                                | Where it runs                       | Use for                                  |
| ----------------------------------------------------- | ----------------------------------- | ---------------------------------------- |
| `getSupabaseServerClient()` from `@kit/supabase/server-client` | Server Components, Server Actions, Route Handlers | Standard reads/writes that respect RLS as the signed-in user |
| `getSupabaseServerAdminClient()` from `@kit/supabase/server-admin-client` | Server-only privileged paths              | Bypassing RLS — admin queries, anonymous inserts under a user-policy gap, audit jobs |
| `useSupabase()` / browser client                      | `'use client'` only                 | Realtime subscriptions, client-side reads where RLS is enough |

Rules:

- **Never** use the admin client outside `'use server'` files / Route
  Handlers. The service role key must not be reachable from the browser.
- **Always** call `client.auth.getUser()` (server) or use `requireUser()` from
  `@kit/supabase/require-user` when an action mutates anything user-owned.
- For admin pages, gate the page with `await requireAdmin()` from `~/lib/admin`
  (redirects to `/auth/sign-in` or `/`).
- **Don't** introduce an ORM (Drizzle/Prisma). The convention is Supabase's
  query builder + the generated `Database` types. When a table is too new for
  the generated types, cast `(client as any).from('new_table')` with a
  comment pointing at the migration that adds it. Drop the cast when the
  types regenerate.

## 7. Roles, perspective, and admin

- **User roles** (`src/lib/user-roles.ts`): `collector | artist | gallery |
  institution`. Use `USER_ROLES.GALLERY` etc. — never bare strings. Validate
  via `isValidRole(...)`.
- **Account-level admin flag**: stored at `accounts.public_data.admin === true`.
  Admin-ness is **not** a separate table. Use `isAdmin(userId)` /
  `requireAdmin()` from `~/lib/admin`.
- **Perspective** (`~/lib/read-perspective.ts`): an *active mode* cookie
  (`user_perspective`) lets a user with multiple profiles act as one role at a
  time. RSC pages that scope by perspective should call `await readPerspective()`.
- **Certificate type** is derived from the poster's role:
  Gallery/Institution → *Show*, Collector → *Ownership*, Artist → *Authenticity*.
  Use `getCertificateTypeForRole(role)` and `getCreateCertificateButtonLabel(...)`.

## 8. Database & migrations

- **Canonical migrations** live in
  `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/`.
  Filename pattern: `YYYYMMDDhhmmss_short_description.sql`.
- **One-off ad-hoc scripts** for v0 / hotfixes go in `scripts/` named
  `YYYY-MM-DD_<feature>.sql`. These are **runnable** but are **not** part of
  the migration history; promote them to a real migration once stable.
- **DATA-SAFE rule** (see `.cursor/rules/migrations-data-safe.mdc`): only
  additive ops (`create table if not exists`, `add column ... if not exists`,
  `create index if not exists`, idempotent `drop policy if exists` + `create
  policy`). No `DROP TABLE` / `TRUNCATE` / unscoped `DELETE` / `DROP COLUMN`
  on user data without a documented plan and a `-- DATA-SAFE:` or
  `-- TOUCHES DATA:` header comment.
- **RLS by default** on every new table. Provide explicit policies for `select`
  / `insert` / `update` / `delete`. Anonymous tickets (`feedback_tickets`) are
  the canonical example of mixing user-scoped and admin-scoped policies.
- **RPC functions** are preferred over multi-statement client-side flows for
  anything that needs atomicity (see `record_user_heartbeat`, `generate_unique_gallery_slug`).

## 9. Server Actions

- **File header**: `'use server';` on its own line, then imports.
- **Auth first**: every mutating action verifies `auth.getUser()` and bails
  with `{ error: ... }` (never throw a string at the UI). Server actions
  return `{ success: true, ... } | { error: string }` shapes — match the
  existing pattern in `create-profile.ts` and `submit-feedback.ts`.
- **Validate inputs** with Zod when they cross trust boundaries (form data,
  `FormData`, JSON bodies). Don't validate everything though — internal
  TS-typed inputs are fine.
- **Revalidate** the affected paths with `revalidatePath('/route')` after
  writes that show up in RSC.
- **Side effects** (notifications, emails) wrapped in `try/catch` so they
  can't break the primary write. Log with `console.error('[Scope] ...', err)`.
- **Stale action errors**: when catching server-action errors on the client,
  call `isStaleServerActionError(err)` from `~/lib/stale-server-action`
  before showing a generic error — and force a reload if true (covers the
  rollback-with-stale-bundle case).

## 10. Route handlers (`/api/...`)

- Always `export async function POST(req: NextRequest)` (or `GET`, etc.).
- **Auth gate** with `getSupabaseServerClient()` + `auth.getUser()`. Return
  `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`.
- **Rate limit** with `checkRateLimit(req, { keyPrefix, windowMs, maxPerWindow })`
  from `~/lib/rate-limit`. The util is in-memory per-process; that's fine for
  a polite cap (heartbeat = 240/min, AI parse = 30/min, feedback = 5/10min).
- **Never** set `runtime = 'edge'` on AI routes (AI SDK 6 hard rule).
- **Webhooks**: signature-verify before doing anything (Stripe webhook is the
  canonical example).
- **Cron**: gate with `Authorization: Bearer ${process.env.CRON_SECRET}` —
  see `src/app/api/cron/...`.

## 11. AI / LLM patterns

- **Use AI SDK 6** (`ai`, `@ai-sdk/react`). The legacy `openai` SDK is still
  in `package.json` for older grants/opportunities chats; **new code uses AI
  SDK 6**.
- **Vercel AI Gateway, zero-config**: pass model strings like
  `'openai/gpt-4o-mini'` directly to `streamText` / `generateText`. Do NOT
  add `@ai-sdk/openai` — it is intentionally not a dep.
- **Streaming structured data**: `streamText({ output: Output.object({ schema }) })`
  with `result.toTextStreamResponse()` on the server, consumed via
  `useObject` from `@ai-sdk/react` on the client. Live example:
  `src/app/api/profiles/parse-input/route.ts` ↔
  `src/app/profiles/_components/taco-profile-chatbot.tsx`.
- **Strict-mode schemas**: every optional field uses `.nullable()` not
  `.optional()`. Drop nulls client-side before forwarding to your action.
- **Heuristic fallback**: when `OPENAI_API_KEY` is missing, ship a regex/
  keyword fallback so dev still works and no key ever blocks PRs (see
  `parse-profile-input.ts` `heuristicParse`).
- **System prompts**: keep them in the action/route file as a `build…Prompt`
  function. They're easier to grep than constants in `~/lib`.

## 12. UI & design system

- **Tokens** (in `src/app/globals.css` + `src/styles/theme.css`):
  - Colors: `--color-parchment` (#F5F1E8), `--color-ink` (#111111),
    `--color-wine` (#4A2F25). Plus shadcn-ui tokens (`--background`,
    `--foreground`, etc.). **Do not** introduce new top-level brand colors
    without a token; never use bare `bg-white` / `text-black`.
  - Fonts: `font-display`, `font-serif`, `font-body` all alias to Gotham
    (with system fallbacks). Apply with `font-display` (titles) and
    `font-serif` (body).
- **Five-color rule**: parchment + wine + ink + 1–2 accents max. No purple
  unless explicitly asked. No gradients unless explicitly asked.
- **Components from `@kit/ui/*`** first (`button`, `card`, `dialog`, `input`,
  `switch`, `textarea`, `select`, `dropdown-menu`, `sonner`, `avatar`,
  `badge`, `tooltip`, ...). Add a new shadcn primitive only if `@kit/ui`
  doesn't already export one.
- **Layout**: flexbox first; grid only for genuine 2-D layouts. Tailwind
  spacing scale only — no `p-[16px]`. Use `gap-*`, never `space-*`.
- **Icons**: `lucide-react` — sized `h-4 w-4` (16) / `h-5 w-5` (20) /
  `h-6 w-6` (24). Never emojis as icons.
- **Mobile-first**: design for narrow first, then `md:` / `lg:` breakpoints.
  The bottom-positioned Sonner toaster in `layout.tsx` keeps mobile nav usable.

## 13. i18n

- Translations live in
  `makerkit/nextjs-saas-starter-kit-lite/apps/provenance/public/locales/<lang>/<ns>.json`.
- Wrap user-facing copy with `<Trans i18nKey="ns:key" defaults="..." />` from
  `@kit/ui/trans` when adding to existing namespaces; otherwise plain English
  is acceptable for engineer-facing surfaces (admin, dev tools).
- The active language is read server-side via `createI18nServerInstance()`.

## 14. Logging (`.cursor/rules/logging-and-errors.mdc` is authoritative)

- **Prefix logs** with the feature scope: `[Profiles]`, `[Feedback]`,
  `[AdminFeedback]`, `[Streak]`, `[Email]`, `[API/grants/chat]`, etc.
- Log on entry, on success, before external calls, and on errors.
  `console.error('[Scope] xyz failed', err)` — always pass the error object so
  Vercel surfaces the stack.
- For structured Vercel-searchable logs, use `~/lib/logger` (`logger.info`,
  `logger.warn`, `logger.error`).
- Never log secrets, tokens, full request bodies, raw passwords, or PII
  beyond the user id.

## 15. Notifications & email

- **Notifications** (in-app): `createNotification({ userId, type, title,
  message?, artworkId?, relatedUserId?, metadata? })` from `~/lib/notifications`.
  Add new `NotificationType` literals to that file. Wrap calls in `try/catch`
  so a notification failure can't break the primary write.
- **Email** (transactional): `sendEmail` and the typed helpers
  (`sendCertificationEmail`, `sendNotificationEmail`, …) from `~/lib/email`.
  When `RESEND_API_KEY` is unset, `sendEmail` silently no-ops (good for dev);
  use `sendTransactionalEmailStrict` if you need to surface errors to admins.
- **Admin fan-out**: when an event should notify all admins, query
  `accounts` where `public_data ->> 'admin' = 'true'` via the **admin client**
  (anonymous tickets won't see admin accounts under user-RLS). See
  `src/app/feedback/_actions/submit-feedback.ts::notifyAdmins`.

## 16. Activity primitives

| Primitive    | What it tracks                                              | Where                                                                |
| ------------ | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Streak       | Daily active days + bonus tiers (`bronze`/`silver`/`gold`) | `~/lib/streak-service.ts`, mounted via `<StreakActivityTracker />`   |
| Presence     | `last_seen_at` + `total_active_minutes` per user           | `<PresenceTracker />` → `/api/heartbeat` → `record_user_heartbeat` RPC |
| Notifications| In-app fan-out                                             | `notifications` table, surfaced in `<NotificationBadge />`            |
| Feedback     | User-submitted tickets (anonymous capable)                 | `/feedback` → `feedback_tickets`, triaged at `/admin/feedback`        |

## 17. Stripe & subscriptions

- Subscriptions are gated by **role** (`artist`, `collector`, `gallery`).
  Certificates remain free for everyone — never gate them.
- `getActiveSubscription(userId)` from `~/lib/subscription` returns the
  user's eligible row (`active` or `trialing`, future-dated). Use that to
  gate features (Grants, Open Calls, AI assistants).
- Stripe price IDs come from `STRIPE_PRICE_<ROLE>_<MONTHLY|YEARLY>` env vars —
  never hardcode prices.

## 18. Build / deploy gotchas

- **pnpm workspace**: `package.json` lives at the **root** but is the
  deployable. The `.npmrc` sets `ignore-workspace-root-check=true` so the
  v0 auto-installer can `pnpm add <pkg>` at the root. If a deploy fails with
  `ERR_PNPM_ADDING_TO_ROOT`, that flag is missing.
- **Edit `package.json` only when the auto-installer can't detect a dep**
  (e.g. config-file-only imports, or a peer that needs explicit pinning).
  Otherwise let the system add the dep.
- **`next.config.ts`** marks all `@kit/*` and `@provenance/*` packages in
  `transpilePackages` for HMR without a build step. New workspace packages
  must be added there.
- **Server Actions body limit**: bumped to 50 MB for iPhone photo flows. If
  you need bigger, edit `serverActions.bodySizeLimit` — but prefer presigned
  Supabase Storage uploads.
- **`/portal` page is no-cache** to defeat stale Server Action IDs after
  rollbacks. Don't blindly copy that header to other routes.

## 19. Things to NEVER do

- ❌ Build new flows on `localStorage` for persistence — always use Supabase.
- ❌ Use the admin Supabase client in a `'use client'` file.
- ❌ Use `runtime = 'edge'` on routes that import `ai` / `@ai-sdk/*`.
- ❌ Call AI SDK functions (`generateText`, `streamText`, `embed`) from
  client components.
- ❌ Add `@ai-sdk/openai`, `@ai-sdk/google`, etc. — the Gateway handles it.
- ❌ Use `generateObject` / `streamObject` (deprecated in AI SDK 6) — use
  `Output.object()` with `streamText` / `generateText`.
- ❌ Drop tables, truncate, or run unscoped deletes/updates in a migration.
- ❌ Add `purple-*`, `violet-*`, gradients, or new brand colors without
  updating the tokens *and* having explicit user request.
- ❌ Introduce an ORM, a new state library, or a new UI kit.
- ❌ Silently swallow errors. Log with a `[Scope]` prefix and rethrow or
  return `{ error }`.
- ❌ Push directly to `main`. Always work on a branch, open a PR.

## 20. Cheat-sheet recipes

### Add a public page
1. Create `src/app/<route>/page.tsx` (RSC) — slim, with `metadata`.
2. Create `_components/` for client UI; mark `'use client'` only where needed.
3. Add `_actions/` with `'use server'` for mutations; revalidate paths.
4. If admin-only, add `await requireAdmin()` at the top.

### Add a new table
1. Write migration in `makerkit/.../supabase/migrations/<ts>_<feature>.sql`
   following the DATA-SAFE rule.
2. Add RLS policies — `select`, `insert`, `update`, `delete` as needed.
3. Add an RPC if multi-step atomicity matters.
4. Until generated types catch up, cast `(client as any).from('new_table')`
   with a comment naming the migration file.

### Add an AI feature
1. Server route in `src/app/api/<feature>/route.ts` using `streamText` +
   `Output.object({ schema })`. Auth + rate-limit at the top.
2. Heuristic fallback when `OPENAI_API_KEY` is unset.
3. Client uses `useObject({ api: '/api/<feature>', schema })` and renders the
   partial object as it streams.
4. Sanitize/strip `null`s before forwarding to a Server Action.

### Add an admin section
1. Page at `src/app/admin/<feature>/page.tsx` with `await requireAdmin()`.
2. Actions in `_actions/<feature>-admin.ts` using
   `getSupabaseServerAdminClient()`.
3. Card on `src/app/admin/page.tsx` linking to the new section.

### Add a notification
1. Add the new literal to the `NotificationType` union in
   `~/lib/notifications.ts`.
2. Call `createNotification({...})` from the server action that triggered the
   event, wrapped in `try/catch`.
3. (Optional) `sendNotificationEmail(...)` for the same event.

---

## 21. When in doubt

- **Search before writing**. There's almost always an existing component,
  helper, or pattern. Use ripgrep across `src/`, then `makerkit/.../packages`.
- **Match the closest sibling's style** rather than introducing a new one.
- **Read `.cursor/rules/*.mdc`** first — those rules win when they collide
  with this file.
- **Open a question** with a 2-line summary of options when the right call
  isn't obvious. Don't guess at architecture.

— Last refreshed: 2026-04 (covers AI SDK 6 migration, presence/feedback/admin
analytics additions, conversational profile creation flow).
