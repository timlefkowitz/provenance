-- Add sold_by field to artworks table
alter table public.artworks
  add column if not exists sold_by text,
  add column if not exists sold_by_is_public boolean default false not null;

comment on column public.artworks.sold_by is 'Who sold the artwork (private by default)';
comment on column public.artworks.sold_by_is_public is 'Whether the sold_by field should be visible to the public';

