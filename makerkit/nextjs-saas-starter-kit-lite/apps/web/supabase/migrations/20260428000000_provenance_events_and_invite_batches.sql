/*
 * Batched certificate claim invites (one token → many rows) and provenance_events.
 */

-- Allow multiple invite rows to share the same token (one email / one accept for batch).
-- Drop UNIQUE on token_hash by catalog lookup (name may differ from certificate_claim_invites_token_hash_key).
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'certificate_claim_invites'
      and c.contype = 'u'
      and conkey is not null
      and (
        select a.attname
        from pg_attribute a
        where a.attrelid = c.conrelid
          and a.attnum = c.conkey[1]
          and not a.attisdropped
      ) = 'token_hash'
  loop
    execute format(
      'alter table public.certificate_claim_invites drop constraint %I',
      r.conname
    );
  end loop;
end $$;

-- Same token_hash may appear on multiple rows (same batch); non-unique index for lookups.
create index if not exists certificate_claim_invites_token_hash_idx
  on public.certificate_claim_invites (token_hash);

-- Optional grouping for portal + bulk consume (nullable for legacy rows).
alter table public.certificate_claim_invites
  add column if not exists batch_id uuid;

create index if not exists certificate_claim_invites_batch_id_status_idx
  on public.certificate_claim_invites (batch_id, status)
  where batch_id is not null;

comment on column public.certificate_claim_invites.batch_id is 'Shared id for invites sent in one batch; same token_hash across rows';

-- Extend claim_kind to include gallery_cos_from_artist (used by app; may have been missing from initial check).
-- Drop existing CHECK on claim_kind regardless of auto-generated name, then replace.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'certificate_claim_invites'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%claim_kind%'
  loop
    execute format(
      'alter table public.certificate_claim_invites drop constraint %I',
      r.conname
    );
  end loop;
end $$;

alter table public.certificate_claim_invites
  add constraint certificate_claim_invites_claim_kind_check
  check (claim_kind in (
    'owner_coownership_from_coa',
    'artist_coa_from_show',
    'artist_coa_from_coo',
    'gallery_show_from_coa',
    'gallery_cos_from_artist'
  ));

comment on column public.certificate_claim_invites.claim_kind is
  'owner_coownership_from_coa | artist_coa_from_show | artist_coa_from_coo | gallery_show_from_coa | gallery_cos_from_artist';

-- ---------------------------------------------------------------------------
-- provenance_events: structured log; app mirrors into former_owners / exhibition_history.
-- ---------------------------------------------------------------------------
create table if not exists public.provenance_events (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  event_type text not null
    check (event_type in (
      'ownership_transfer',
      'exhibition',
      'authentication',
      'coa_issued',
      'coo_issued',
      'cos_issued'
    )),
  actor_account_id uuid references auth.users(id) on delete set null,
  actor_name text,
  related_artwork_id uuid references public.artworks(id) on delete set null,
  event_date timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists provenance_events_artwork_id_event_date_idx
  on public.provenance_events (artwork_id, event_date desc);

comment on table public.provenance_events is 'Structured provenance history; mirrored into artworks text fields where applicable';

alter table public.provenance_events enable row level security;

-- Owners of the artwork can read events for certificates they hold.
drop policy if exists provenance_events_select_own_artwork on public.provenance_events;
create policy provenance_events_select_own_artwork on public.provenance_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.artworks a
      where a.id = provenance_events.artwork_id
        and a.account_id = (select auth.uid())
    )
  );

grant select on table public.provenance_events to authenticated;

-- Service role / migrations insert via admin client (bypasses RLS).

-- ---------------------------------------------------------------------------
-- Lookup auth user id by email (service_role only) for invite notifications.
-- ---------------------------------------------------------------------------
create or replace function public.get_user_id_by_email_for_notifications(p_email text)
returns uuid
language sql
stable
security definer
set search_path = auth
as $$
  select id
  from auth.users
  where lower(trim(email)) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.get_user_id_by_email_for_notifications(text) from public;
grant execute on function public.get_user_id_by_email_for_notifications(text) to service_role;
