/*
 * Add owner_coownership_from_cos claim kind to support ownership certificates from Certificate of Show.
 * This enables galleries to sell artworks and transfer ownership directly to buyers.
 */

-- Drop existing CHECK constraint on claim_kind
do $$
declare
  r record;
begin
  -- Find all CHECK constraints on certificate_claim_invites.claim_kind
  for r in 
    select constraint_name 
    from information_schema.constraint_column_usage 
    where table_name = 'certificate_claim_invites' 
      and column_name = 'claim_kind'
      and constraint_schema = 'public'
  loop
    execute format('alter table public.certificate_claim_invites drop constraint if exists %I', r.constraint_name);
  end loop;
end $$;

-- Add updated constraint with the new claim kind
alter table public.certificate_claim_invites
  add constraint certificate_claim_invites_claim_kind_check
  check (claim_kind in (
    'owner_coownership_from_coa',
    'owner_coownership_from_cos',
    'artist_coa_from_show',
    'artist_coa_from_coo',
    'gallery_show_from_coa',
    'gallery_cos_from_artist'
  ));

-- Update column comment to reflect new claim kind
comment on column public.certificate_claim_invites.claim_kind is
  'owner_coownership_from_coa | owner_coownership_from_cos | artist_coa_from_show | artist_coa_from_coo | gallery_show_from_coa | gallery_cos_from_artist';