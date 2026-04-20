/*
 * -------------------------------------------------------
 * Add Institution Role
 * Extends user roles to include 'institution' alongside
 * artist, collector, and gallery.
 * -------------------------------------------------------
 */

-- Update the role check constraint on user_profiles to include 'institution'
alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('collector', 'artist', 'gallery', 'institution'));

-- Update the role check constraint on subscriptions to include 'institution'
alter table public.subscriptions
  drop constraint if exists subscriptions_role_check;

alter table public.subscriptions
  add constraint subscriptions_role_check
  check (role in ('artist', 'collector', 'gallery', 'institution'));

-- Institution profiles may have multiple entries per user (like galleries).
-- The existing partial unique index already handles this correctly because
-- it only restricts uniqueness for 'artist' and 'collector' roles.
-- No change needed to user_profiles_user_role_unique_artist_collector.

comment on column public.user_profiles.role is
  'The role this profile represents: collector, artist, gallery, or institution';

comment on column public.subscriptions.role is
  'The billing role: artist, collector, gallery, or institution';
