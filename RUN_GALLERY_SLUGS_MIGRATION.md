# Running the Gallery Slugs Migration

This migration adds short link support for gallery profiles. Gallery profiles will get unique slugs (e.g., "FL!GHT" → "flight") enabling short URLs like `/g/flight`.

## Migration Safety

**This migration is 100% safe** - it only:
- ✅ ADDS a new `slug` column to `user_profiles` table (nullable, so existing data is unaffected)
- ✅ Creates indexes for faster lookups
- ✅ Creates a function to generate unique slugs
- ✅ Updates existing gallery profiles to have slugs (doesn't delete anything)

**It does NOT:**
- ❌ Delete any data
- ❌ Drop any columns
- ❌ Modify existing data (only adds slugs)
- ❌ Break any existing functionality

## Quick Fix

### For Production (Remote Supabase):

**Option 1: Using Supabase CLI (Recommended)**
```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase db push --linked
```

Or if you're already linked:
```bash
supabase db push
```

**Option 2: Using Supabase SQL Editor**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of:
   `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20250121000000_add_gallery_slugs.sql`
4. Click **Run**

### For Local Development:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase db push
```

## What the Migration Does

The migration file `20250121000000_add_gallery_slugs.sql` will:

1. ✅ Add `slug` varchar(100) column to `user_profiles` table
2. ✅ Create unique index for gallery profile slugs (ensures uniqueness)
3. ✅ Create index for faster slug lookups
4. ✅ Create `generate_unique_gallery_slug()` function for auto-generating slugs
5. ✅ Generate slugs for all existing gallery profiles (e.g., "FL!GHT" → "flight")

## After Migration

Once the migration runs:
- All existing gallery profiles will have slugs generated automatically
- New gallery profiles will get slugs when created
- Gallery profile slugs will regenerate when names change
- Short links will work: `/g/[slug]` redirects to gallery profile
- Certificates will use short links when available

## Verify Migration Ran Successfully

After running the migration, you can verify it worked by:

1. **Check the column exists:**
   - Go to Supabase Dashboard → Table Editor → `user_profiles`
   - You should see a new `slug` column

2. **Check existing galleries have slugs:**
   ```sql
   SELECT id, name, slug, role 
   FROM user_profiles 
   WHERE role = 'gallery' 
   LIMIT 10;
   ```
   All gallery profiles should have slugs.

3. **Test a short link:**
   - If you have a gallery profile with slug "flight", visit `/g/flight`
   - It should redirect to the gallery profile page

## Troubleshooting

**If you get an error about Supabase not being linked:**
```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

**If the migration says "column already exists":**
- The migration may have already been run
- You can safely ignore this or check if slugs are already populated

**If slugs aren't generating for new profiles:**
- Check that the `generate_unique_gallery_slug()` function exists
- Verify the function is callable: `SELECT generate_unique_gallery_slug('Test Gallery');`

## Rollback (if needed)

If you need to rollback this migration (though it's safe and shouldn't be necessary):

```sql
-- Remove indexes
DROP INDEX IF EXISTS user_profiles_slug_unique_gallery;
DROP INDEX IF EXISTS user_profiles_slug_idx;

-- Remove function
DROP FUNCTION IF EXISTS generate_unique_gallery_slug(text);

-- Remove column (WARNING: This will delete slug data)
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS slug;
```

**Note:** Rolling back is not recommended as it's a safe, additive migration that doesn't affect existing functionality.

