/*
 * -------------------------------------------------------
 * Institution setup and privacy
 *
 * When someone accepts an institution invite they land on a short setup page
 * (statement, logo, banner, privacy). These columns hold the privacy answers
 * and record that setup was done, so later team members see the answers
 * already filled in.
 *
 *   is_private                  : hide the public profile page and white-label
 *                                 site from anyone outside the team.
 *   artworks_private_by_default : new works filed under this profile start
 *                                 private (is_public = false).
 *   setup_completed_at / _by    : when setup was first saved, and by whom.
 *
 * DATA SAFE: adds nullable / defaulted columns only. No DROP, TRUNCATE,
 * DELETE, or UPDATE of existing rows.
 * -------------------------------------------------------
 */

alter table public.user_profiles
  add column if not exists is_private boolean not null default false,
  add column if not exists artworks_private_by_default boolean not null default false,
  add column if not exists setup_completed_at timestamptz,
  add column if not exists setup_completed_by uuid references auth.users (id) on delete set null;

comment on column public.user_profiles.is_private is
  'Team profiles only: hide the public profile page and site from anyone outside the team.';
comment on column public.user_profiles.artworks_private_by_default is
  'Team profiles only: new works filed under this profile start private.';
comment on column public.user_profiles.setup_completed_at is
  'When the institution setup step was first saved.';
