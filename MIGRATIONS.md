# Database Migrations

## Safety: Migrations Do Not Wipe User Data

**Our migrations are written to be additive and safe.** They do not delete or truncate user data.

### What we do

- **Create** new tables with `create table if not exists`
- **Add** columns, indexes, policies, triggers, and functions
- **Replace** RLS policies with `drop policy if exists` then `create policy` (permissions only; no data change)
- **Drop** only constraints/triggers/policies (e.g. `drop constraint if exists`, `drop policy if exists`) when changing schema or RLS
- **Backfill** with `insert ... on conflict do nothing` so reruns are safe

### What we do not do

- **No** `drop table` (tables are never dropped)
- **No** `truncate` (no bulk row deletion)
- **No** `delete from` without a narrow, intentional `where` (we don’t run broad deletes in migrations)
- **No** `alter table ... drop column` (we don’t remove columns in migrations)

### Verifying before you run

You can search migrations for dangerous patterns:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations
grep -ri "drop table\|truncate\|delete from\|drop column" . || echo "No dangerous patterns found"
```

If that prints only “No dangerous patterns found” (or only `drop policy if exists` / `drop trigger if exists` / `drop constraint if exists`), the set is consistent with this policy.

---

## Syncing Migrations to Your Remote (Production) Supabase

Migrations live under **makerkit** and must be applied to your **remote** Supabase project so production uses the same schema.

### One-time: Link your remote project

From the app that contains the Supabase config (the makerkit web app):

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase link --project-ref YOUR_PROJECT_REF
```

- Get **YOUR_PROJECT_REF** from the Supabase dashboard: Project Settings → General → Reference ID.
- When prompted, use your database password (or the one from Project Settings → Database).

### Apply migrations to remote

After linking, push all pending migrations:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase db push
```

- Only migrations that haven’t been applied yet will run.
- Supabase tracks applied migrations in the remote DB; rerunning `db push` is safe.

### Using npm/pnpm scripts (if configured)

If the makerkit web app has a deploy script that links and pushes:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
SUPABASE_PROJECT_REF=your_ref pnpm supabase:deploy
```

(Or set `SUPABASE_PROJECT_REF` in `.env` and run `pnpm supabase:deploy`.)

### Optional: Run a single migration via SQL Editor

For a one-off fix or if you can’t use the CLI:

1. Open Supabase Dashboard → SQL Editor.
2. Paste the contents of the migration file from  
   `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/`.
3. Run the script.

Run migrations in **timestamp order** (by filename) and only run each migration once.

---

## Summary

| Question | Answer |
|----------|--------|
| Do migrations wipe user data? | **No.** They are additive; no `drop table`, `truncate`, or broad `delete`. |
| Do I need to sync to remote? | **Yes.** Run `supabase db push` from the makerkit web app directory after linking. |
| Where are migrations? | `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/` |
| One-time setup | `cd makerkit/.../apps/web` → `supabase link --project-ref YOUR_REF` |
| Apply new migrations | `cd makerkit/.../apps/web` → `supabase db push` |

For more detail on specific migration sets (e.g. gallery members), see the `RUN_*.md` guides in the repo (e.g. `RUN_GALLERY_TEAM_MEMBERS_MIGRATION.md`).
