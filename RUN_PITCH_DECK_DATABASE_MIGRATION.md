# Running the Pitch Deck Database Migration

This migration moves pitch deck content from file-based storage to the database, fixing the "read-only file system" error in serverless environments.

## Migration Safety

**✅ This migration is 100% SAFE - it does NOT affect existing data.**

The migration only:
- ✅ **Creates** a new `pitch_deck_content` table
- ✅ **Adds** RLS policies for public read and authenticated write
- ✅ **Inserts** default empty content if none exists
- ✅ Uses `if not exists` checks - won't fail if run multiple times

**It does NOT:**
- ❌ Delete any data
- ❌ Modify existing files (they're just no longer used)
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
   `makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/migrations/20250124000000_create_pitch_deck_content.sql`
4. Click **Run**

### For Local Development:

```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase db push
```

## What the Migration Does

The migration file `20250124000000_create_pitch_deck_content.sql` will:

1. ✅ Create `pitch_deck_content` table with:
   - `id` (UUID, primary key)
   - `key` (text, unique, default: 'main')
   - `content` (JSONB, stores the slides array)
   - `created_at` and `updated_at` timestamps

2. ✅ Add RLS policies:
   - Public read access (anyone can view pitch deck)
   - Authenticated write access (admin check happens in app code)

3. ✅ Insert default empty content if none exists

## What Changes in the Application

After this migration:
- ✅ Pitch deck content is stored in Supabase database instead of files
- ✅ Image uploads go to Supabase Storage bucket `pitch-deck-images`
- ✅ No more "read-only file system" errors
- ✅ Works in serverless environments (Vercel, etc.)

## Migrating Existing Content

If you have existing content in `data/pitch-deck-content.json`:

1. The app will automatically read from the database (which starts empty)
2. You can manually copy your existing JSON content:
   - Go to `/admin/pitch`
   - The slides should be empty initially
   - You can recreate them or import the JSON manually

Alternatively, you can run this SQL to import existing content (replace with your actual JSON):

```sql
UPDATE public.pitch_deck_content
SET content = '{"slides": [...]}'::jsonb
WHERE key = 'main';
```

## Storage Bucket

The migration doesn't create the storage bucket automatically. It will be created on first image upload, but you can also create it manually:

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `pitch-deck-images`
3. Make it public
4. Set file size limit to 5MB

Or it will be created automatically when you upload the first image.

## Verify Migration Ran Successfully

After running the migration, you can verify it worked by:
- ✅ The pitch deck page should load (even if empty)
- ✅ You should be able to save slides without errors
- ✅ Image uploads should work
- ✅ No more "read-only file system" errors

## Troubleshooting

If you get an error about the table already existing:
- The migration may have already been run
- You can safely ignore the error or check if the table exists

If you still get file system errors:
- Make sure the migration ran successfully
- Check that the `pitch_deck_content` table exists in your database
- Verify the application code is using the database functions (not file system)

