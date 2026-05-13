/*
 * Add artist_cv_file_path to user_profiles
 * Stores the private storage path (not URL) so owners can download the original
 * CV via a time-limited signed URL.
 */
alter table public.user_profiles
  add column if not exists artist_cv_file_path text;

comment on column public.user_profiles.artist_cv_file_path is
  'Storage path of the original uploaded CV in the private artist-cvs bucket (used to mint signed URLs for owner-only download).';
