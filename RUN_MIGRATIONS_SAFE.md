# Running Supabase Migrations (Safe – No User Data Wiped)

## Do you need to run them?

**Yes.** Migrations in code do **not** run automatically against your remote Supabase database. You need to apply them once per environment (e.g. production).

## Are they safe? Will they wipe user data?

**Yes, they’re safe.** These migrations do **not**:

- **DROP** any user tables  
- **TRUNCATE** any tables  
- **DELETE** rows (except RLS policies, which only define *who can* delete)  
- **UPDATE** data except one harmless change: `certificate_type = 'collection'` → `'ownership'` (label only)

They only:

- **ADD** columns (with defaults so existing rows are unchanged)  
- **CREATE** / **DROP** RLS policies (permissions; no row data removed)  
- **CREATE** functions, indexes, and **GRANT** execute  
- **UPDATE** one column value: `certificate_type` from `'collection'` to `'ownership'` where applicable  

So **user data is not wiped** by these migrations.

## How to run migrations

### Option A: Supabase Dashboard (recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Run the migration files **in order by filename** (oldest first).  
   Path in repo: `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/`
3. If a migration was already applied (e.g. “column already exists”), that’s fine; skip or ignore the error and continue with the next file.

### Option B: Supabase CLI

**From the project root** (the folder that contains `makerkit`, `src`, `package.json`):

```bash
cd /Users/timothylefkowitz/projects/provenance/makerkit/nextjs-saas-starter-kit-lite/apps/web && npx supabase db push
```

Or if you’re already in the project root:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web && npx supabase db push
```

If the project isn’t linked yet:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web && npx supabase link --project-ref YOUR_PROJECT_REF && npx supabase db push
```

Only migrations that haven’t been applied yet will run.

## Certificate-type migrations (recent)

- **20250213000001_add_certificate_type_to_artworks.sql** – Adds `certificate_type` column (default `'authenticity'`). Existing rows get the default; no data removed.
- **20250213000002_certificate_type_ownership.sql** – Updates `certificate_type` from `'collection'` to `'ownership'` where applicable, and updates the column comment. No rows deleted.

Both are safe and do not wipe user data.
