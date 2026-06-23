/*
 * -------------------------------------------------------
 * Grants: Community Sharing & Proposal Docs
 *
 * 1. Extend artist_grants with community sharing fields
 * 2. grant_upvotes — one per user per grant, count synced via trigger
 * 3. grant_reports — user-submitted moderation reports
 * 4. grant_proposals — AI-drafted + user-edited proposal documents
 *
 * DATA-SAFE: all artist_grants changes are additive (add column if not
 * exists). Existing rows are not touched; new columns get safe defaults.
 * The SELECT policy replacement is a superset of the previous one —
 * it still exposes every row the old policy exposed, plus community rows.
 * -------------------------------------------------------
 */

-- ─── 1. Extend artist_grants ───────────────────────────────────────────────

-- All three new columns are additive. Existing rows receive the defaults
-- immediately (PostgreSQL applies a non-volatile column default without a
-- full table rewrite on PG 11+, so this is instant and safe on production).
alter table public.artist_grants
  add column if not exists is_community   boolean   not null default false,
  add column if not exists shared_by      uuid      references auth.users(id) on delete set null,
  add column if not exists shared_by_name text,
  add column if not exists upvote_count   integer   not null default 0;

comment on column public.artist_grants.is_community   is 'True = shared by an artist to be visible to all authenticated users';
comment on column public.artist_grants.shared_by      is 'User who shared this grant with the community; set null if that user is deleted';
comment on column public.artist_grants.shared_by_name is 'Display name of the sharing user (denormalised for fast reads)';
comment on column public.artist_grants.upvote_count   is 'Cached count of upvotes, kept in sync by trigger on grant_upvotes';

-- ─── Replace the SELECT policy on artist_grants ────────────────────────────
--
-- Previous policy (from 20250318000000_artist_grants_curated.sql):
--   artist_grants_select_own  →  user_id = auth.uid() OR user_id IS NULL
--
-- New policy is a strict superset: it grants access to everything the old
-- policy granted, and additionally exposes community-shared rows.
-- No existing row loses visibility.

drop policy if exists artist_grants_select_own    on public.artist_grants;
drop policy if exists artist_grants_select_curated on public.artist_grants;
drop policy if exists artist_grants_select         on public.artist_grants;

create policy artist_grants_select on public.artist_grants
  for select to authenticated
  using (
    user_id = auth.uid()   -- user's own saved grants
    or user_id is null     -- platform-curated grants (seeded, user_id null)
    or is_community = true -- community-shared grants (user chose to share)
  );

-- ─── 2. grant_upvotes ─────────────────────────────────────────────────────

create table if not exists public.grant_upvotes (
  grant_id   uuid not null references public.artist_grants(id) on delete cascade,
  user_id    uuid not null references auth.users(id)           on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (grant_id, user_id)
);

comment on table public.grant_upvotes is 'One row per user per community grant; drives artist_grants.upvote_count';

-- Separate indexes for reverse lookups (primary key already covers grant_id, user_id)
create index if not exists grant_upvotes_grant_id_idx on public.grant_upvotes(grant_id);
create index if not exists grant_upvotes_user_id_idx  on public.grant_upvotes(user_id);

alter table public.grant_upvotes enable row level security;

drop policy if exists grant_upvotes_select_own on public.grant_upvotes;
drop policy if exists grant_upvotes_insert_own on public.grant_upvotes;
drop policy if exists grant_upvotes_delete_own on public.grant_upvotes;

create policy grant_upvotes_select_own on public.grant_upvotes
  for select to authenticated using (user_id = auth.uid());

create policy grant_upvotes_insert_own on public.grant_upvotes
  for insert to authenticated with check (user_id = auth.uid());

create policy grant_upvotes_delete_own on public.grant_upvotes
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on table public.grant_upvotes to authenticated;

-- Trigger: keep upvote_count in sync.
-- Uses SECURITY DEFINER + explicit search_path so it can UPDATE artist_grants
-- rows owned by other users (e.g. curated rows with user_id NULL) without
-- requiring a permissive UPDATE policy for the caller.
-- When a grant is deleted (cascade), the trigger fires on orphaned upvote
-- deletes, but the UPDATE finds 0 rows and is silently a no-op — safe.
create or replace function sync_grant_upvote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.artist_grants
       set upvote_count = upvote_count + 1
     where id = NEW.grant_id;
  elsif TG_OP = 'DELETE' then
    update public.artist_grants
       set upvote_count = greatest(0, upvote_count - 1)
     where id = OLD.grant_id;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_grant_upvote_count_trigger on public.grant_upvotes;
create trigger sync_grant_upvote_count_trigger
  after insert or delete on public.grant_upvotes
  for each row execute function sync_grant_upvote_count();

-- ─── 3. grant_reports ─────────────────────────────────────────────────────

create table if not exists public.grant_reports (
  id         uuid                     primary key default extensions.uuid_generate_v4(),
  grant_id   uuid        not null     references public.artist_grants(id) on delete cascade,
  user_id    uuid        not null     references auth.users(id)           on delete cascade,
  reason     text        not null,
  created_at timestamp with time zone not null default now()
);

comment on table public.grant_reports is 'User-submitted reports on community grants for admin moderation';

create index if not exists grant_reports_grant_id_idx on public.grant_reports(grant_id);
create index if not exists grant_reports_user_id_idx  on public.grant_reports(user_id);

alter table public.grant_reports enable row level security;

drop policy if exists grant_reports_insert_own on public.grant_reports;
drop policy if exists grant_reports_select_own on public.grant_reports;

-- Users can submit reports (checked: reporter must match auth.uid())
create policy grant_reports_insert_own on public.grant_reports
  for insert to authenticated
  with check (user_id = auth.uid());

-- A user can see only their own reports (prevents fishing for others' reports)
create policy grant_reports_select_own on public.grant_reports
  for select to authenticated
  using (user_id = auth.uid());

-- Admins read all reports via service role (bypasses RLS)
grant select, insert on table public.grant_reports to authenticated;

-- ─── 4. grant_proposals ───────────────────────────────────────────────────

create table if not exists public.grant_proposals (
  id                uuid                     primary key default extensions.uuid_generate_v4(),
  user_id           uuid        not null     references auth.users(id)           on delete cascade,
  artist_profile_id uuid                     references public.user_profiles(id) on delete set null,
  -- Nullable: proposal may not be tied to a specific saved grant
  grant_id          uuid                     references public.artist_grants(id) on delete set null,
  title             text        not null     default 'Untitled Proposal',
  content_json      jsonb,
  content_text      text,
  status            text        not null     default 'draft',
  created_at        timestamp with time zone not null default now(),
  updated_at        timestamp with time zone not null default now()
);

comment on table public.grant_proposals is 'AI-drafted grant proposals that artists can edit and refine';
comment on column public.grant_proposals.content_json is 'TipTap JSON document state';
comment on column public.grant_proposals.content_text is 'Plain text extract for search and preview';
comment on column public.grant_proposals.status       is 'draft | in_progress | submitted';

create index if not exists grant_proposals_user_id_idx    on public.grant_proposals(user_id);
create index if not exists grant_proposals_grant_id_idx   on public.grant_proposals(grant_id);
create index if not exists grant_proposals_updated_at_idx on public.grant_proposals(updated_at desc);

alter table public.grant_proposals enable row level security;

drop policy if exists grant_proposals_select_own on public.grant_proposals;
drop policy if exists grant_proposals_insert_own on public.grant_proposals;
drop policy if exists grant_proposals_update_own on public.grant_proposals;
drop policy if exists grant_proposals_delete_own on public.grant_proposals;

create policy grant_proposals_select_own on public.grant_proposals
  for select to authenticated
  using (user_id = auth.uid());

create policy grant_proposals_insert_own on public.grant_proposals
  for insert to authenticated
  with check (user_id = auth.uid());

create policy grant_proposals_update_own on public.grant_proposals
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy grant_proposals_delete_own on public.grant_proposals
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on table public.grant_proposals to authenticated;

-- updated_at auto-stamp (no security definer needed — trigger modifies NEW,
-- not a separate table, so it runs with the caller's privileges which already
-- passed the UPDATE policy check)
create or replace function update_grant_proposals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_grant_proposals_updated_at_trigger on public.grant_proposals;
create trigger update_grant_proposals_updated_at_trigger
  before update on public.grant_proposals
  for each row execute function update_grant_proposals_updated_at();
