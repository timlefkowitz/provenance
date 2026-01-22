/*
 * -------------------------------------------------------
 * Allow Multiple Gallery Profiles
 * Users can now create multiple gallery profiles
 * Artist and Collector profiles remain limited to one per user
 * -------------------------------------------------------
 */

-- Drop the existing unique constraint that prevents multiple profiles of the same role
alter table public.user_profiles drop constraint if exists user_profiles_user_id_role_key;

-- Create a partial unique index that only enforces uniqueness for artist and collector roles
-- This allows multiple gallery profiles per user, but only one artist and one collector
create unique index if not exists user_profiles_user_role_unique_artist_collector
on public.user_profiles(user_id, role)
where role in ('artist', 'collector');

-- Add a comment explaining the constraint
comment on index user_profiles_user_role_unique_artist_collector is 
'Ensures users can only have one artist and one collector profile, but allows multiple gallery profiles';

