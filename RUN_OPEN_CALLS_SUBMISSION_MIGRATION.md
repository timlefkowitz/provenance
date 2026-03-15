# Open Calls: Submission Dates, Type, and Location Eligibility

This migration adds submission window, call type, and location eligibility to open calls so artists can filter and see active vs expired calls.

## ✅ Data-safe

**This migration does not wipe or delete any user data.**

It only:

- **Adds** four new columns to `public.open_calls` with `ADD COLUMN IF NOT EXISTS`:
  - `submission_open_date` (date, nullable)
  - `submission_closing_date` (date, nullable)
  - `call_type` (text, default `'exhibition'`)
  - `eligible_locations` (text[], default `'{}'`)
- **Adds** indexes and column comments.
- **Backfills** only rows where the new date columns are still `NULL`, using the linked exhibition’s `start_date` / `end_date`. It does not overwrite any non-null values.

No `DROP TABLE`, `TRUNCATE`, `DELETE`, or `DROP COLUMN`. Safe to run multiple times (idempotent).

## Apply to remote

You need to run this migration on your **remote** Supabase project so production matches the app.

### Option A: Supabase CLI (recommended)

From the makerkit web app directory:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase db push
```

If you haven’t linked yet:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Only migrations that haven’t been applied yet will run.

### Option B: SQL Editor

1. Open **Supabase Dashboard** → **SQL Editor**.
2. Paste the contents of  
   `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20250315000000_open_calls_submission_and_type.sql`.
3. Run the script.

Run migrations in **timestamp order** (by filename); run each migration only once.

## After running

- Existing open calls get `call_type = 'exhibition'` and submission dates from their exhibition.
- New open calls created in the app will have submission open/close, type, and optional eligible locations set by the gallery.
- Browse page can show active vs expired and filter by type and “qualifies for my location.”
