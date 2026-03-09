/*
 * -------------------------------------------------------
 * Artist Claim flow: request type + link artist CoA to source cert
 * - provenance_update_requests: allow request_type 'artist_claim'
 * - artworks: source_artwork_id for artist's Certificate of Authenticity
 *   linked to the collector/gallery Certificate of Show or Ownership
 * -------------------------------------------------------
 *
 * DATA-SAFE: Does not wipe or overwrite user data.
 * - DROP CONSTRAINT / ADD CONSTRAINT: only changes the allowed values for
 *   request_type; existing rows keep their current values (all valid under
 *   the new check).
 * - ADD COLUMN source_artwork_id: additive only (if not exists); existing
 *   rows are unchanged (new column is NULL).
 * - No DELETE, TRUNCATE, DROP TABLE, or UPDATE of user data.
 */

-- Allow 'artist_claim' in provenance_update_requests
alter table public.provenance_update_requests
  drop constraint if exists provenance_update_requests_request_type_check;

alter table public.provenance_update_requests
  add constraint provenance_update_requests_request_type_check
  check (request_type in ('provenance_update', 'ownership_request', 'artist_claim'));

-- Link artist's Certificate of Authenticity to the source certificate (show/ownership)
alter table public.artworks
  add column if not exists source_artwork_id uuid references public.artworks(id) on delete set null;

comment on column public.artworks.source_artwork_id is 'For artist CoA created via claim: the collector/gallery certificate this was created from';

create index if not exists artworks_source_artwork_id_idx on public.artworks(source_artwork_id);
