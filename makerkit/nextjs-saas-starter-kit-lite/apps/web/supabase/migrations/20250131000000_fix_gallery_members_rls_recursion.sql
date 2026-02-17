/*
 * -------------------------------------------------------
 * Fix infinite recursion in gallery_members RLS policies
 * Policies that checked "is user owner/admin?" did so by
 * selecting from gallery_members again, causing recursion.
 * Use a SECURITY DEFINER helper to bypass RLS for that check.
 *
 * DATA SAFE: No DROP TABLE, TRUNCATE, DELETE, or UPDATE.
 * Only: create/replace function + drop/create RLS policies.
 * All gallery_members rows and all other data are unchanged.
 * -------------------------------------------------------
 */

-- Helper: can the current user act as owner/admin for this gallery profile?
-- Uses SECURITY DEFINER so it can read gallery_members without triggering RLS.
create or replace function public.is_gallery_owner_or_admin(p_gallery_profile_id uuid)
returns boolean as $$
begin
  return (
    -- Gallery profile owner (creator)
    exists (
      select 1 from public.user_profiles up
      where up.id = p_gallery_profile_id
        and up.user_id = auth.uid()
        and up.role = 'gallery'
    )
    or
    -- Already a gallery_members row as owner/admin (read bypasses RLS in this function)
    exists (
      select 1 from public.gallery_members gm
      where gm.gallery_profile_id = p_gallery_profile_id
        and gm.user_id = auth.uid()
        and gm.role in ('owner', 'admin')
    )
  );
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.is_gallery_owner_or_admin(uuid) is 'Returns true if current user is gallery profile owner or gallery_members owner/admin. Used in RLS to avoid self-reference recursion.';

-- Allow authenticated users to call this from RLS policies
grant execute on function public.is_gallery_owner_or_admin(uuid) to authenticated;

-- Drop policies that self-reference gallery_members
drop policy if exists gallery_members_read_gallery on public.gallery_members;
drop policy if exists gallery_members_insert_owner on public.gallery_members;
drop policy if exists gallery_members_update_owner on public.gallery_members;
drop policy if exists gallery_members_delete_owner on public.gallery_members;

-- Recreate using helper (no self-reference)
create policy gallery_members_read_gallery on public.gallery_members
  for select
  to authenticated
  using (
    is_gallery_owner_or_admin(gallery_profile_id)
  );

create policy gallery_members_insert_owner on public.gallery_members
  for insert
  to authenticated
  with check (
    is_gallery_owner_or_admin(gallery_profile_id)
  );

create policy gallery_members_update_owner on public.gallery_members
  for update
  to authenticated
  using (
    is_gallery_owner_or_admin(gallery_profile_id)
  )
  with check (
    is_gallery_owner_or_admin(gallery_profile_id)
  );

create policy gallery_members_delete_owner on public.gallery_members
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or is_gallery_owner_or_admin(gallery_profile_id)
  );
