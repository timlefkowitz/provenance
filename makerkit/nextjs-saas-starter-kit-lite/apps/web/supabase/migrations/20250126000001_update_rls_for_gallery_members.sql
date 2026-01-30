/*
 * -------------------------------------------------------
 * Update RLS Policies for Gallery Team Members
 * Allows gallery members to manage gallery profiles, artworks, and exhibitions
 * -------------------------------------------------------
 */

-- ============================================================
-- Update user_profiles policies to allow gallery members
-- ============================================================

-- Drop and recreate user_profiles_update_own to include gallery members
drop policy if exists user_profiles_update_own on public.user_profiles;

create policy user_profiles_update_own on public.user_profiles
    for update
    to authenticated
    using (
        user_id = (select auth.uid()) -- Profile owner
        or exists ( -- Gallery member
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = user_profiles.id
            and gm.user_id = (select auth.uid())
            and user_profiles.role = 'gallery'
        )
    )
    with check (
        user_id = (select auth.uid()) -- Profile owner
        or exists ( -- Gallery member
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = user_profiles.id
            and gm.user_id = (select auth.uid())
            and user_profiles.role = 'gallery'
        )
    );

-- ============================================================
-- Update artworks policies to allow gallery members
-- ============================================================

-- Helper function to check if user is a gallery member for an artwork
-- This checks both account_id (for backwards compatibility) and gallery_profile_id
create or replace function is_gallery_member_for_artwork(artwork_account_id uuid, artwork_gallery_profile_id uuid)
returns boolean as $$
begin
    -- If artwork has a gallery_profile_id, check membership for that profile
    if artwork_gallery_profile_id is not null then
        return exists (
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = artwork_gallery_profile_id
            and gm.user_id = (select auth.uid())
        );
    end if;
    
    -- Otherwise, check if user owns the account or is a member of any gallery profile owned by that account
    return artwork_account_id = (select auth.uid())
        or exists (
            select 1 from public.gallery_members gm
            join public.user_profiles up on gm.gallery_profile_id = up.id
            where up.user_id = artwork_account_id
            and up.role = 'gallery'
            and gm.user_id = (select auth.uid())
        );
end;
$$ language plpgsql security definer;

-- Drop existing artworks policies
drop policy if exists artworks_read_own on public.artworks;
drop policy if exists artworks_read_public on public.artworks;
drop policy if exists artworks_insert on public.artworks;
drop policy if exists artworks_update on public.artworks;
drop policy if exists artworks_delete on public.artworks;

-- Public can read verified AND public artworks (for the feed) - MUST be first for public access
create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified' 
        and is_public = true
    );

-- Users can read their own artworks OR artworks from galleries they're members of
create policy artworks_read_own on public.artworks
    for select
    to authenticated
    using (
        account_id = (select auth.uid())
        or is_gallery_member_for_artwork(account_id, gallery_profile_id)
    );

-- Users can insert artworks for their account OR for galleries they're members of
create policy artworks_insert on public.artworks
    for insert
    to authenticated
    with check (
        account_id = (select auth.uid())
        or (
            gallery_profile_id is not null
            and exists (
                select 1 from public.gallery_members gm
                where gm.gallery_profile_id = artworks.gallery_profile_id
                and gm.user_id = (select auth.uid())
            )
        )
    );

-- Users can update their own artworks OR artworks from galleries they're members of
create policy artworks_update on public.artworks
    for update
    to authenticated
    using (
        account_id = (select auth.uid())
        or is_gallery_member_for_artwork(account_id, gallery_profile_id)
    )
    with check (
        account_id = (select auth.uid())
        or is_gallery_member_for_artwork(account_id, gallery_profile_id)
    );

-- Users can delete their own artworks OR artworks from galleries they're members of
create policy artworks_delete on public.artworks
    for delete
    to authenticated
    using (
        account_id = (select auth.uid())
        or is_gallery_member_for_artwork(account_id, gallery_profile_id)
    );

-- ============================================================
-- Update exhibitions policies to allow gallery members
-- ============================================================

-- Helper function to check if user is a gallery member for an exhibition
create or replace function is_gallery_member_for_exhibition(exhibition_gallery_id uuid)
returns boolean as $$
begin
    -- Check if user owns the gallery account
    if exhibition_gallery_id = (select auth.uid()) then
        return true;
    end if;
    
    -- Check if user is a member of any gallery profile owned by that account
    return exists (
        select 1 from public.gallery_members gm
        join public.user_profiles up on gm.gallery_profile_id = up.id
        where up.user_id = exhibition_gallery_id
        and up.role = 'gallery'
        and gm.user_id = (select auth.uid())
    );
end;
$$ language plpgsql security definer;

-- Drop existing exhibitions policies
drop policy if exists exhibitions_insert_own on public.exhibitions;
drop policy if exists exhibitions_update_own on public.exhibitions;
drop policy if exists exhibitions_delete_own on public.exhibitions;

-- Gallery owners/members can insert exhibitions
create policy exhibitions_insert_own on public.exhibitions
    for insert
    to authenticated
    with check (
        gallery_id = (select auth.uid())
        or is_gallery_member_for_exhibition(gallery_id)
    );

-- Gallery owners/members can update exhibitions
create policy exhibitions_update_own on public.exhibitions
    for update
    to authenticated
    using (
        gallery_id = (select auth.uid())
        or is_gallery_member_for_exhibition(gallery_id)
    )
    with check (
        gallery_id = (select auth.uid())
        or is_gallery_member_for_exhibition(gallery_id)
    );

-- Gallery owners/members can delete exhibitions
create policy exhibitions_delete_own on public.exhibitions
    for delete
    to authenticated
    using (
        gallery_id = (select auth.uid())
        or is_gallery_member_for_exhibition(gallery_id)
    );

-- ============================================================
-- Update exhibition_artists policies to allow gallery members
-- ============================================================

-- Drop existing policies
drop policy if exists exhibition_artists_insert_own on public.exhibition_artists;
drop policy if exists exhibition_artists_delete_own on public.exhibition_artists;

-- Gallery owners/members can manage artists for their exhibitions
create policy exhibition_artists_insert_own on public.exhibition_artists
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.exhibitions e
            where e.id = exhibition_artists.exhibition_id
            and (
                e.gallery_id = (select auth.uid())
                or is_gallery_member_for_exhibition(e.gallery_id)
            )
        )
    );

-- Gallery owners/members can delete artists from their exhibitions
create policy exhibition_artists_delete_own on public.exhibition_artists
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.exhibitions e
            where e.id = exhibition_artists.exhibition_id
            and (
                e.gallery_id = (select auth.uid())
                or is_gallery_member_for_exhibition(e.gallery_id)
            )
        )
    );

-- ============================================================
-- Update exhibition_artworks policies to allow gallery members
-- ============================================================

-- Drop existing policies
drop policy if exists exhibition_artworks_insert_own on public.exhibition_artworks;
drop policy if exists exhibition_artworks_delete_own on public.exhibition_artworks;

-- Gallery owners/members can manage artworks for their exhibitions
create policy exhibition_artworks_insert_own on public.exhibition_artworks
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.exhibitions e
            where e.id = exhibition_artworks.exhibition_id
            and (
                e.gallery_id = (select auth.uid())
                or is_gallery_member_for_exhibition(e.gallery_id)
            )
        )
    );

-- Gallery owners/members can delete artworks from their exhibitions
create policy exhibition_artworks_delete_own on public.exhibition_artworks
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.exhibitions e
            where e.id = exhibition_artworks.exhibition_id
            and (
                e.gallery_id = (select auth.uid())
                or is_gallery_member_for_exhibition(e.gallery_id)
            )
        )
    );
