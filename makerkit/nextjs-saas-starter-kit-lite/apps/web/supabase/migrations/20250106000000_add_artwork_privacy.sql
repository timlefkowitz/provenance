/*
 * -------------------------------------------------------
 * Add Privacy Field to Artworks Table
 * Adds is_public field to control artwork visibility
 * 
 * SAFE MIGRATION - This migration:
 * - Only ADDS a new column (does not delete or modify existing data)
 * - Sets default value to true for all existing artworks
 * - Does not remove or change any existing artwork records
 * - Only updates RLS policies (does not affect data)
 * -------------------------------------------------------
 */

-- Step 1: Add is_public column with default value
-- Using 'if not exists' to make it safe to run multiple times
-- Default value ensures existing rows get 'true' automatically
alter table public.artworks
    add column if not exists is_public boolean default true not null;

comment on column public.artworks.is_public is 'Whether the artwork is visible to the public (true) or private (false)';

-- Step 2: Ensure all existing artworks are set to public
-- This UPDATE is safe because:
-- - It only affects rows where is_public is null (shouldn't happen with default, but just in case)
-- - It only sets the value, doesn't delete or modify other data
-- - Safe to run multiple times (idempotent)
update public.artworks
set is_public = true
where is_public is null;

-- Step 3: Create index for faster queries (safe, doesn't affect data)
create index if not exists artworks_is_public_idx on public.artworks(is_public);

-- Step 4: Update RLS policies to respect privacy settings
-- This is safe because:
-- - 'if exists' prevents errors if policy doesn't exist
-- - Only changes access rules, doesn't modify data
-- - Users can still read their own artworks (existing policy remains)
drop policy if exists artworks_read_public on public.artworks;

-- New policy: Public can only read verified AND public artworks
create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified' 
        and is_public = true
    );

-- Note: Users can always read their own artworks (regardless of privacy setting)
-- The existing 'artworks_read_own' policy already handles this and remains unchanged

