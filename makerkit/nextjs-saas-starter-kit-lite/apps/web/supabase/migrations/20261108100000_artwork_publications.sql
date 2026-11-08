/*
 * -------------------------------------------------------
 * Artwork publications
 * Books, catalogues, magazines and articles a specific work has appeared
 * in, listed on its certificate. A work with at least one publication
 * earns a premium on its Provenance Value (see lib/valuation/provenance-value).
 * Shape: [{ title, publication_name?, url?, date? }]
 * -------------------------------------------------------
 */

alter table public.artworks
  add column if not exists publications jsonb not null default '[]'::jsonb;

comment on column public.artworks.publications is
  'Publications featuring this work: [{ title, publication_name?, url?, date? }]';
