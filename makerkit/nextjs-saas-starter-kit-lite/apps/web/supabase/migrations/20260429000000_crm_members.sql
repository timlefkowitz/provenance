/*
 * CRM team membership: lets an artist share their CRM with other users.
 */

-- ─── crm_members table ───────────────────────────────────────────────────────

create table if not exists public.crm_members (
  id           uuid        primary key default gen_random_uuid(),
  artist_user_id uuid      not null references auth.users(id) on delete cascade,
  member_user_id uuid      not null references auth.users(id) on delete cascade,
  invited_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique(artist_user_id, member_user_id)
);

comment on table  public.crm_members                    is 'Users granted access to an artist''s CRM board';
comment on column public.crm_members.artist_user_id     is 'The artist who owns the CRM';
comment on column public.crm_members.member_user_id     is 'The user being granted access';
comment on column public.crm_members.invited_by         is 'Who added this member';

create index if not exists crm_members_artist_idx on public.crm_members(artist_user_id);
create index if not exists crm_members_member_idx on public.crm_members(member_user_id);

alter table public.crm_members enable row level security;

-- Artist (owner) and the member themselves can see the row
drop policy if exists crm_members_select on public.crm_members;
create policy crm_members_select on public.crm_members
  for select to authenticated
  using (
    artist_user_id = (select auth.uid())
    or member_user_id = (select auth.uid())
  );

-- Only the artist owner can add members
drop policy if exists crm_members_insert on public.crm_members;
create policy crm_members_insert on public.crm_members
  for insert to authenticated
  with check (artist_user_id = (select auth.uid()));

-- Owner or the member themselves can remove the row
drop policy if exists crm_members_delete on public.crm_members;
create policy crm_members_delete on public.crm_members
  for delete to authenticated
  using (
    artist_user_id = (select auth.uid())
    or member_user_id = (select auth.uid())
  );

grant select, insert, delete on table public.crm_members to authenticated;

-- ─── Helper function ─────────────────────────────────────────────────────────

create or replace function public.is_crm_member(p_artist_user_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
begin
  -- The owner always has access to their own CRM
  if p_artist_user_id = (select auth.uid()) then
    return true;
  end if;
  -- Otherwise the user must have an explicit membership row
  return exists (
    select 1 from public.crm_members
    where artist_user_id = p_artist_user_id
      and member_user_id = (select auth.uid())
  );
end;
$$;

-- ─── Update artist_leads RLS to include team members ─────────────────────────

drop policy if exists artist_leads_select_own    on public.artist_leads;
drop policy if exists artist_leads_insert_own    on public.artist_leads;
drop policy if exists artist_leads_update_own    on public.artist_leads;
drop policy if exists artist_leads_delete_own    on public.artist_leads;
drop policy if exists artist_leads_select_member on public.artist_leads;
drop policy if exists artist_leads_insert_member on public.artist_leads;
drop policy if exists artist_leads_update_member on public.artist_leads;
drop policy if exists artist_leads_delete_member on public.artist_leads;

create policy artist_leads_select_member on public.artist_leads
  for select to authenticated
  using (public.is_crm_member(artist_user_id));

create policy artist_leads_insert_member on public.artist_leads
  for insert to authenticated
  with check (public.is_crm_member(artist_user_id));

create policy artist_leads_update_member on public.artist_leads
  for update to authenticated
  using  (public.is_crm_member(artist_user_id))
  with check (public.is_crm_member(artist_user_id));

create policy artist_leads_delete_member on public.artist_leads
  for delete to authenticated
  using (public.is_crm_member(artist_user_id));

-- ─── CRM column label customisation ─────────────────────────────────────────
-- Stores per-artist custom names for the four pipeline stages.
-- column_labels keys match the stage check values; absent keys fall back to
-- the app-level defaults at render time.

create table if not exists public.crm_settings (
  artist_user_id uuid primary key references auth.users(id) on delete cascade,
  column_labels  jsonb        not null default '{}'::jsonb,
  updated_at     timestamptz  not null default now()
);

comment on table  public.crm_settings               is 'Per-artist CRM preferences (column label overrides, etc.)';
comment on column public.crm_settings.column_labels is 'JSON map of stage → custom label, e.g. {"interested":"Hot Leads"}';

alter table public.crm_settings enable row level security;

-- Artist (owner) and team members can read; only owner can write
drop policy if exists crm_settings_select on public.crm_settings;
create policy crm_settings_select on public.crm_settings
  for select to authenticated
  using (public.is_crm_member(artist_user_id));

drop policy if exists crm_settings_insert on public.crm_settings;
create policy crm_settings_insert on public.crm_settings
  for insert to authenticated
  with check (artist_user_id = (select auth.uid()));

drop policy if exists crm_settings_update on public.crm_settings;
create policy crm_settings_update on public.crm_settings
  for update to authenticated
  using  (artist_user_id = (select auth.uid()))
  with check (artist_user_id = (select auth.uid()));

grant select, insert, update on table public.crm_settings to authenticated;
