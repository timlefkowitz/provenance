/*
 * -------------------------------------------------------
 * Add Established Year Field for Gallery Profiles
 * -------------------------------------------------------
 */

-- Add established_year column to user_profiles table
alter table if exists public.user_profiles
  add column if not exists established_year integer;

comment on column public.user_profiles.established_year is 'Year the gallery was established (for gallery profiles)';

