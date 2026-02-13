/*
 * -------------------------------------------------------
 * Certificate Type by Poster Role
 * Gallery posting → Certificate of Show
 * Collector posting → Certificate of Collection
 * Artist posting → Certificate of Authenticity (default)
 * -------------------------------------------------------
 */

alter table public.artworks
  add column if not exists certificate_type varchar(50) default 'authenticity';

comment on column public.artworks.certificate_type is 'Type of certificate: authenticity (artist), show (gallery), collection (collector)';

create index if not exists artworks_certificate_type_idx on public.artworks(certificate_type);
