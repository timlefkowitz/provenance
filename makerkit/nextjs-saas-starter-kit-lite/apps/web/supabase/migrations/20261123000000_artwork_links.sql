/*
 * -------------------------------------------------------
 * Artwork links
 * Links for a specific work (the artist's Instagram post, a video, a shop
 * page), added in Collection Management and printable as extra QR codes on
 * its wall label.
 * Shape: [{ id, label, url }]
 * -------------------------------------------------------
 */

alter table public.artworks
  add column if not exists links jsonb not null default '[]'::jsonb;

comment on column public.artworks.links is
  'Links for this work, printable as wall-label QR codes: [{ id, label, url }]';
