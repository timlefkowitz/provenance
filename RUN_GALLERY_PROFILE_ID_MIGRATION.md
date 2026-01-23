# Running the Gallery Profile ID Migration

This migration adds support for selecting which gallery profile to post artworks as when users have multiple gallery profiles.

## Migration Safety

**✅ This migration is 100% SAFE - it does NOT wipe any user data.**

The migration only:
- ✅ **Adds** a new nullable `gallery_profile_id` column to `artworks` table - existing data unchanged
- ✅ **Creates** a foreign key reference to `user_profiles` with `on delete set null` - safe operation
- ✅ **Adds** an index for faster queries - doesn't affect existing data
- ✅ Uses `if not exists` checks - won't fail if run multiple times

**It does NOT:**
- ❌ Delete any data
- ❌ Drop any columns
- ❌ Modify existing artwork data (only adds a new nullable column)
- ❌ Break any existing functionality
- ❌ Require any data backfill (existing artworks will have NULL, which is fine)

## What Happens to Existing Artworks

- Existing artworks will have `gallery_profile_id = NULL` (which is expected and safe)
- This doesn't affect their visibility or functionality
- Only new artworks posted after this migration will have the gallery profile ID set
- You can optionally backfill existing artworks later if needed (see below)

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
   `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20250123000000_add_gallery_profile_id_to_artworks.sql`
4. Click **Run**

### For Local Development:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase db push
```

## What the Migration Does

The migration file `20250123000000_add_gallery_profile_id_to_artworks.sql` will:

1. ✅ Add `gallery_profile_id` uuid column to `artworks` table (nullable)
2. ✅ Create foreign key reference to `user_profiles(id)` with `on delete set null`
3. ✅ Add index for faster queries on `gallery_profile_id`
4. ✅ Add comment explaining the column purpose

## After Migration

Once the migration runs:
- New artworks posted by galleries with multiple profiles will require selecting which gallery to post as
- New artworks posted by galleries with a single profile will auto-select that profile
- Existing artworks will continue to work normally (with NULL gallery_profile_id)
- The gallery profile selector will appear in the artwork creation form when users have multiple gallery profiles

## Optional: Backfilling Existing Artworks

If you want to backfill existing artworks with gallery profile IDs, you can run this SQL (optional, not required):

```sql
-- Backfill gallery_profile_id for existing artworks posted by galleries
-- This finds the first active gallery profile for each gallery user
UPDATE public.artworks a
SET gallery_profile_id = (
  SELECT up.id
  FROM public.user_profiles up
  WHERE up.user_id = a.account_id
    AND up.role = 'gallery'
    AND up.is_active = true
  ORDER BY up.created_at ASC
  LIMIT 1
)
WHERE a.gallery_profile_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.accounts ac
    WHERE ac.id = a.account_id
      AND (ac.public_data->>'role')::text = 'gallery'
  );
```

**Note**: This backfill is optional. Existing artworks work fine without it.

## Verify Migration Ran Successfully

After running the migration, you can verify it worked by:
- Checking that the migration appears in your Supabase dashboard under **Database** → **Migrations**
- The gallery profile selector should appear when posting artworks as a gallery with multiple profiles
- No errors should occur when creating new artworks

## Troubleshooting

If you get an error about Supabase not being linked:
```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

To find your project ref, check your Supabase dashboard URL or run:
```bash
supabase projects list
```

If the column already exists:
- The migration uses `IF NOT EXISTS` checks, so it's safe to run multiple times
- You can safely ignore any "column already exists" errors

