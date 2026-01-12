/*
 * -------------------------------------------------------
 * Add Additional Artwork Fields
 * Adds: value, edition, production_location, owned_by
 * With privacy controls for value and owned_by
 * -------------------------------------------------------
 */

-- Add new fields to artworks table
alter table public.artworks
  add column if not exists value text,
  add column if not exists value_is_public boolean default false not null,
  add column if not exists edition varchar(255),
  add column if not exists production_location text,
  add column if not exists owned_by text,
  add column if not exists owned_by_is_public boolean default false not null;

comment on column public.artworks.value is 'Monetary value of the artwork (private by default)';
comment on column public.artworks.value_is_public is 'Whether the value field should be visible to the public';
comment on column public.artworks.edition is 'Edition information (e.g., "1/10", "Limited Edition", "Unique")';
comment on column public.artworks.production_location is 'Location where the artwork was produced/created';
comment on column public.artworks.owned_by is 'Current owner of the artwork (private by default)';
comment on column public.artworks.owned_by_is_public is 'Whether the owned_by field should be visible to the public';

