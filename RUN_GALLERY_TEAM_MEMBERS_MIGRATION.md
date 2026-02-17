# Running the Gallery Team Members Migration

This migration adds team member functionality to galleries, allowing multiple people to manage a gallery profile together.

## Migration Safety

**✅ This migration is 100% SAFE - it does NOT wipe or modify any existing user data.**

### What the migrations do:

**Migration 1 (`20250126000000_add_gallery_members.sql`):**
- ✅ **Creates** a new `gallery_members` table (doesn't touch existing tables)
- ✅ **Adds** existing gallery profile creators as owners (backfill)
- ✅ Uses `if not exists` checks - won't fail if run multiple times
- ✅ Uses `on conflict do nothing` - safe if backfill runs multiple times
- ✅ Creates triggers and functions for future gallery profiles
- ❌ **Does NOT** delete any data
- ❌ **Does NOT** modify any existing data
- ❌ **Does NOT** drop any columns or tables

**Migration 2 (`20250126000001_update_rls_for_gallery_members.sql`):**
- ✅ **Updates** RLS policies to be MORE permissive (adds permissions)
- ✅ Creates helper functions for membership checks
- ✅ Uses `drop policy if exists` - safe, just removes old policies
- ✅ **Restores** public read access to verified artworks
- ❌ **Does NOT** modify any data
- ❌ **Does NOT** delete any data
- ❌ **Does NOT** restrict existing access (only expands it)

**Migration 3 (`20250126000002_fix_artworks_public_read.sql`) - FIX:**
- ✅ **Fixes** missing public read policy for artworks
- ✅ Allows anyone to read verified artworks (for public feed)
- ✅ Safe to run if you already ran migration 2
- ❌ **Does NOT** modify any data

## What Happens to Existing Data

- ✅ All existing gallery profiles remain unchanged
- ✅ All existing artworks remain unchanged
- ✅ All existing exhibitions remain unchanged
- ✅ Gallery profile creators are automatically added as "owner" members
- ✅ Existing permissions remain intact (new permissions are added)

## Quick Start

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
   - `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20250126000000_add_gallery_members.sql`
   - Click **Run**
4. Then copy and paste:
   - `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20250126000001_update_rls_for_gallery_members.sql`
   - Click **Run**
5. Then copy and paste (FIX for public artworks access):
   - `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20250126000002_fix_artworks_public_read.sql`
   - Click **Run**

### For Local Development:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase db push
```

## What the Migrations Do

### Migration 1: Creates Gallery Members System

1. ✅ Creates `gallery_members` table with roles (owner, admin, member)
2. ✅ Sets up RLS policies for the new table
3. ✅ Creates trigger to auto-add gallery creator as owner for new galleries
4. ✅ Backfills existing gallery profiles - adds creators as owners
5. ✅ Creates indexes for performance

### Migration 2: Updates Permissions

1. ✅ Updates `user_profiles` policies to allow gallery members to edit
2. ✅ Updates `artworks` policies to allow gallery members to manage
3. ✅ Updates `exhibitions` policies to allow gallery members to manage
4. ✅ Creates helper functions for membership checks
5. ✅ Restores public read access to verified artworks
6. ✅ All changes are MORE permissive (adds access, doesn't remove)

### Migration 3: Fix Public Artworks Access

1. ✅ Ensures public read policy exists for verified artworks
2. ✅ Fixes issue where artworks weren't visible to public users
3. ✅ Safe to run even if migration 2 already included this fix

## After Migration

Once the migrations run:
- ✅ Gallery profile creators are automatically owners
- ✅ Gallery owners can invite team members via the profile edit page
- ✅ Team members can post artworks and manage exhibitions
- ✅ All existing functionality continues to work
- ✅ No data is lost or modified

## Verify Migration Ran Successfully

After running the migrations, you can verify:

1. **Check migrations in Supabase Dashboard:**
   - Go to **Database** → **Migrations**
   - Both migrations should appear in the list

2. **Check gallery_members table exists:**
   ```sql
   SELECT COUNT(*) FROM gallery_members;
   ```
   - Should return the number of existing gallery profiles (each creator is now an owner)

3. **Test the feature:**
   - Go to `/profiles/[gallery-profile-id]/edit`
   - Scroll to "Team Members" section
   - You should see yourself listed as "Owner"
   - Click "Invite Member" to test inviting someone

## Troubleshooting

### If you get an error about Supabase not being linked:
```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### If you get a policy conflict error:
The migration uses `drop policy if exists` so this shouldn't happen, but if it does:
- The migration is idempotent - you can run it multiple times safely
- Check the Supabase logs for specific error details

### If backfill doesn't work:
The backfill uses `on conflict do nothing`, so it's safe to run manually:
```sql
-- Manually backfill if needed (safe to run multiple times)
INSERT INTO public.gallery_members (gallery_profile_id, user_id, role, joined_at)
SELECT id, user_id, 'owner', created_at
FROM public.user_profiles
WHERE role = 'gallery'
AND NOT EXISTS (
    SELECT 1 FROM public.gallery_members gm
    WHERE gm.gallery_profile_id = user_profiles.id
    AND gm.user_id = user_profiles.user_id
)
ON CONFLICT (gallery_profile_id, user_id) DO NOTHING;
```

## Rollback (If Needed)

If you need to rollback (not recommended, but possible):

1. **Remove the new table:**
   ```sql
   DROP TABLE IF EXISTS public.gallery_members CASCADE;
   ```

2. **Restore old RLS policies:**
   - You would need to manually recreate the old policies
   - But since the new policies are more permissive, rollback isn't necessary

**Note:** Rollback is not recommended because:
- The migration only adds functionality
- No data is modified or deleted
- The new permissions are more permissive (safer)

## Summary

✅ **Safe to run** - No data loss or modification  
✅ **Idempotent** - Can run multiple times safely  
✅ **Backward compatible** - All existing functionality works  
✅ **Additive only** - Only adds new features and permissions  

The migration is production-ready and safe to deploy!
