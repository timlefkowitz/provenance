# Running the Artist Profile Claims Migration

This migration adds the artist profile claims system, allowing galleries to create unclaimed artist profiles and artists to claim them.

## Migration Safety

**✅ This migration is 100% SAFE - it does NOT wipe any user data.**

The migration only:
- ✅ **Modifies** `user_profiles.user_id` to allow NULL (removes NOT NULL constraint) - existing data unchanged
- ✅ **Adds** new columns with defaults (`created_by_gallery_id`, `is_claimed`, `claimed_at`) - existing data unaffected
- ✅ **Updates** existing profiles to mark them as claimed (sets `is_claimed = true`) - safe operation
- ✅ **Creates** new empty table `artist_profile_claims` - doesn't affect existing data
- ✅ **Adds** indexes and RLS policies - safe operations

**It does NOT:**
- ❌ Delete any data
- ❌ Drop any columns
- ❌ Modify existing user data (only adds new columns and sets flags)
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
   `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20250122000000_add_artist_profile_claims.sql`
4. Click **Run**

### For Local Development:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase db push
```

## What the Migration Does

The migration file `20250122000000_add_artist_profile_claims.sql` will:

1. ✅ Modify `user_profiles.user_id` to allow NULL (for unclaimed profiles)
2. ✅ Add `created_by_gallery_id` column to track which gallery created the profile
3. ✅ Add `is_claimed` boolean column (defaults to `true` for existing profiles)
4. ✅ Add `claimed_at` timestamp column
5. ✅ Mark all existing profiles as claimed (`is_claimed = true`)
6. ✅ Create new `artist_profile_claims` table for claim requests
7. ✅ Add indexes for performance
8. ✅ Set up RLS policies for security
9. ✅ Update `user_profiles` insert policy to allow galleries to create unclaimed profiles

## After Migration

Once the migration runs:
- ✅ All existing user profiles remain unchanged and marked as claimed
- ✅ Galleries can now create unclaimed artist profiles when adding artwork
- ✅ Artists can claim profiles through `/profiles/claims`
- ✅ Galleries can approve/reject claims through `/profiles/claims`
- ✅ Notifications will be sent for claim requests and approvals

## Verify Migration Ran Successfully

After running the migration, you can verify it worked by:
1. Check that the migration appears in Supabase dashboard → Database → Migrations
2. Check that `artist_profile_claims` table exists
3. Check that `user_profiles` table has the new columns (`created_by_gallery_id`, `is_claimed`, `claimed_at`)
4. Try adding artwork as a gallery - it should create unclaimed profiles
5. Visit `/profiles/claims` as an artist to see unclaimed profiles

## Troubleshooting

### If you get an error about Supabase not being linked:
```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

To find your project ref:
- Check your Supabase dashboard URL
- Or run: `supabase projects list`

### If you get a constraint error:
- The migration uses `IF NOT EXISTS` and `IF EXISTS` clauses, so it should be idempotent
- If you see errors about existing policies, they're safe to ignore (the migration drops and recreates them)

### If existing profiles show as unclaimed:
- This shouldn't happen, but if it does, you can manually fix with:
  ```sql
  UPDATE user_profiles SET is_claimed = true WHERE user_id IS NOT NULL;
  ```

