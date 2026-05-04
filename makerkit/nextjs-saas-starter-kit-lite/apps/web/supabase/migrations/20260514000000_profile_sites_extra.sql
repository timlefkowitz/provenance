/*
 * -------------------------------------------------------
 * Profile Sites — extra creator controls
 * Adds hero image, tagline, about override, artwork filters,
 * and surface color so users can personalize their site.
 * -------------------------------------------------------
 *
 * SAFETY: This migration is purely additive on the
 * profile_sites table created by 20260513000000. It does not
 * touch any other table, drop columns, or alter constraints.
 */

alter table public.profile_sites
  add column if not exists hero_image_url text,
  add column if not exists tagline text,
  add column if not exists about_override text,
  add column if not exists surface_color text,
  add column if not exists artwork_filters jsonb not null default '{
    "certificate_types": ["authenticity", "ownership", "show"]
  }'::jsonb;

comment on column public.profile_sites.hero_image_url is
  'Optional banner / hero image for the site (separate from profile picture). Public URL.';

comment on column public.profile_sites.tagline is
  'Optional one-line tagline displayed under the site name in templates.';

comment on column public.profile_sites.about_override is
  'Optional rich-text override for the about / bio section. Falls back to user_profiles.bio when null.';

comment on column public.profile_sites.surface_color is
  'Optional surface (background) color key from the constrained palette: cream, charcoal, slate, parchment, ink.';

comment on column public.profile_sites.artwork_filters is
  'JSON: { certificate_types: ("authenticity" | "ownership" | "show")[] } — controls which artwork types appear on the site.';
