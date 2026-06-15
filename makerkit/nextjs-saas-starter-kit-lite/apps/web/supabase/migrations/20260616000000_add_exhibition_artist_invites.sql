/*
 * exhibition_artist_invites: token-based email invites for artists to submit
 * artwork to an exhibition. Artist creates COA on submit; gallery gets linked COS.
 *
 * RLS enabled with no policies: only service role / server admin client from app.
 */

create table if not exists public.exhibition_artist_invites (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  invitee_email text not null,
  invitee_name text,
  artist_account_id uuid references public.accounts(id) on delete set null,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in (
      'pending',
      'sent',
      'consumed',
      'cancelled',
      'expired'
    )),
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  consumed_at timestamptz,
  consumed_by uuid references auth.users(id) on delete set null,
  result_artwork_id uuid references public.artworks(id) on delete set null,
  result_cos_artwork_id uuid references public.artworks(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.exhibition_artist_invites is
  'Email invite tokens for artists to submit artwork to an exhibition; token_hash is SHA-256 of opaque token';

create index if not exists exhibition_artist_invites_exhibition_id_idx
  on public.exhibition_artist_invites (exhibition_id);

create index if not exists exhibition_artist_invites_status_idx
  on public.exhibition_artist_invites (status);

create index if not exists exhibition_artist_invites_expires_at_idx
  on public.exhibition_artist_invites (expires_at);

create unique index if not exists exhibition_artist_invites_open_email_idx
  on public.exhibition_artist_invites (exhibition_id, lower(invitee_email))
  where status in ('pending', 'sent');

-- Sensitive invite data (emails, token hashes): server-only access.
-- Matches admin_contacts / certificate_claim_invites pattern — no user-facing RLS policies.
alter table public.exhibition_artist_invites enable row level security;

revoke all on table public.exhibition_artist_invites from anon, authenticated;
grant all on table public.exhibition_artist_invites to service_role;

comment on column public.exhibition_artist_invites.invitee_email is
  'PII: invitee email address; only accessible via service_role server actions';
comment on column public.exhibition_artist_invites.token_hash is
  'SHA-256 hash of opaque invite token; raw token is never stored';

create or replace function public.update_exhibition_artist_invites_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_exhibition_artist_invites_updated_at_trigger
  on public.exhibition_artist_invites;

create trigger update_exhibition_artist_invites_updated_at_trigger
  before update on public.exhibition_artist_invites
  for each row
  execute function public.update_exhibition_artist_invites_updated_at();
