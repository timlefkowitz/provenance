# Running the Registry Migration

The registry page requires a migration to allow public read access to accounts. Without this migration, users will only see their own account in the registry.

## Quick Fix

Run this migration in your Supabase SQL Editor:

### For Production (Remote Supabase):

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of:
   `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20250107000000_allow_public_account_read.sql`
4. Click **Run**

### For Local Development:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase db push
```

Or if you're already linked:
```bash
supabase db push
```

## What the Migration Does

The migration file `20250107000000_allow_public_account_read.sql` will:
1. ✅ Add a new RLS policy `accounts_read_public` 
2. ✅ Allow authenticated and anonymous users to read all accounts
3. ✅ Only exposes public fields (id, name, picture_url, public_data)
4. ✅ Does NOT allow write access (UPDATE/INSERT/DELETE still restricted)
5. ✅ Does NOT expose sensitive fields like email

**This migration is 100% safe** - it only ADDS a new policy and doesn't delete or modify any existing data.

## Verify Migration Ran Successfully

After running the migration, you can verify it worked by:
- The registry page should show all accounts, not just your own
- You should see multiple artists/galleries if they exist
- The error should go away

## Troubleshooting

If you get an error about the policy already existing:
- The migration may have already been run
- You can safely ignore the error or use `CREATE POLICY IF NOT EXISTS` (though the migration uses `CREATE POLICY`)

If you still only see one account after running the migration:
- Check that the migration ran successfully in the SQL Editor
- Verify the policy exists: Go to **Authentication** → **Policies** → **accounts** table
- You should see a policy named `accounts_read_public`

