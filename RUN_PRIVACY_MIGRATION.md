# Running the Privacy Migration

The `is_public` column needs to be added to your database before you can use the privacy feature.

## Quick Fix

Run this migration to add the privacy column:

### For Local Development:
```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase db push
```

### For Production (Remote Supabase):
```bash
cd makerkit/nextjs-saas-starter-kit-lite/apps/web
supabase db push --linked
```

Or if you're already linked:
```bash
supabase db push
```

## What the Migration Does

The migration file `20250106000000_add_artwork_privacy.sql` will:
1. ✅ Add `is_public` boolean column to artworks table
2. ✅ Set all existing artworks to public (default)
3. ✅ Create an index for faster queries
4. ✅ Update RLS policies to respect privacy settings

**This migration is 100% safe** - it only ADDS a column and doesn't delete or modify any existing data.

## Verify Migration Ran Successfully

After running the migration, you can verify it worked by checking:
- The error should go away when uploading artworks
- You should see the privacy toggle in the artwork creation form
- Existing artworks should still be visible (they'll all be public)

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

