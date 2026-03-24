/*
 * certificate_claim_invites: secure token-based email flows for linked certificates.
 *
 * claim_kind:
 *   owner_coownership_from_coa — collector claims linked COO from artist COA
 *   artist_coa_from_show       — artist completes CoA after owner approved show claim
 *   artist_coa_from_coo        — artist completes CoA after owner approved COO claim
 *   gallery_show_from_coa      — reserved for future invite flows (optional)
 *
 * RLS enabled with no policies: only service role / server admin client from app.
 */

create table if not exists public.certificate_claim_invites (
  id uuid primary key default gen_random_uuid(),
  source_artwork_id uuid not null references public.artworks(id) on delete cascade,
  claim_kind text not null
    check (claim_kind in (
      'owner_coownership_from_coa',
      'artist_coa_from_show',
      'artist_coa_from_coo',
      'gallery_show_from_coa'
    )),
  invitee_email text not null,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in (
      'pending',
      'pending_owner_approval',
      'sent',
      'consumed',
      'cancelled',
      'expired'
    )),
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  provenance_update_request_id uuid references public.provenance_update_requests(id) on delete set null,
  consumed_at timestamptz,
  consumed_by uuid references auth.users(id) on delete set null,
  result_artwork_id uuid references public.artworks(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.certificate_claim_invites is 'Email invite tokens for claiming linked certificates; token_hash is SHA-256 of opaque token';
comment on column public.certificate_claim_invites.claim_kind is 'owner_coownership_from_coa | artist_coa_from_show | artist_coa_from_coo | gallery_show_from_coa';

create index if not exists certificate_claim_invites_source_artwork_id_idx
  on public.certificate_claim_invites (source_artwork_id);
create index if not exists certificate_claim_invites_status_idx
  on public.certificate_claim_invites (status);
create index if not exists certificate_claim_invites_expires_at_idx
  on public.certificate_claim_invites (expires_at);
create index if not exists certificate_claim_invites_provenance_request_idx
  on public.certificate_claim_invites (provenance_update_request_id);

alter table public.certificate_claim_invites enable row level security;

create or replace function public.update_certificate_claim_invites_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_certificate_claim_invites_updated_at_trigger on public.certificate_claim_invites;
create trigger update_certificate_claim_invites_updated_at_trigger
  before update on public.certificate_claim_invites
  for each row
  execute function public.update_certificate_claim_invites_updated_at();
