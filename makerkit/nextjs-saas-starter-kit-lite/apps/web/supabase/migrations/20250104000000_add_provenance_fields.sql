/*
 * -------------------------------------------------------
 * Add Provenance Fields to Artworks Table
 * Adds fields for comprehensive provenance tracking
 * -------------------------------------------------------
 */

-- Add provenance fields to artworks table
alter table public.artworks
    add column if not exists former_owners text,
    add column if not exists auction_history text,
    add column if not exists exhibition_history text,
    add column if not exists historic_context text,
    add column if not exists celebrity_notes text;

comment on column public.artworks.former_owners is 'Names of former owners: prominent collectors, estates, galleries, or institutions';
comment on column public.artworks.auction_history is 'Records of previous sales at auction houses (including dates and lot numbers)';
comment on column public.artworks.exhibition_history is 'Exhibition history or literature references where the work has been discussed';
comment on column public.artworks.historic_context is 'Historic context / origin information: how and where it was acquired originally';
comment on column public.artworks.celebrity_notes is 'Special notes on celebrity or notable ownership';

