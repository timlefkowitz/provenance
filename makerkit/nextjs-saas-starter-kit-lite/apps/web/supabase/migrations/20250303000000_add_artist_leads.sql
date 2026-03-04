/*
 * -------------------------------------------------------
 * Artist Leads (sales/interest kanban)
 * 4-stage board: interested → contacted → negotiating → sold
 * -------------------------------------------------------
 *
 * DATA-SAFE: Does not wipe user data.
 * - create table if not exists (no DROP TABLE)
 * - create index if not exists, RLS policies, grant, trigger only
 * - No DELETE, TRUNCATE, or DROP TABLE on any existing tables.
 */

create table if not exists public.artist_leads (
    id uuid unique not null default extensions.uuid_generate_v4(),
    artist_user_id uuid not null references auth.users(id) on delete cascade,
    contact_name varchar(255),
    contact_email text,
    contact_phone text,
    notes text,
    stage varchar(50) not null default 'interested' check (stage in ('interested', 'contacted', 'negotiating', 'sold')),
    artwork_id uuid references public.artworks(id) on delete set null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    primary key (id)
);

comment on table public.artist_leads is 'Leads for artists: people interested in buying artwork';
comment on column public.artist_leads.artist_user_id is 'The artist (auth user) who owns this lead';
comment on column public.artist_leads.stage is 'Kanban stage: interested, contacted, negotiating, sold';

create index if not exists artist_leads_artist_user_id_idx on public.artist_leads(artist_user_id);
create index if not exists artist_leads_stage_idx on public.artist_leads(stage);
create index if not exists artist_leads_artwork_id_idx on public.artist_leads(artwork_id);

alter table public.artist_leads enable row level security;

drop policy if exists artist_leads_select_own on public.artist_leads;
drop policy if exists artist_leads_insert_own on public.artist_leads;
drop policy if exists artist_leads_update_own on public.artist_leads;
drop policy if exists artist_leads_delete_own on public.artist_leads;

create policy artist_leads_select_own on public.artist_leads
    for select to authenticated
    using (artist_user_id = (select auth.uid()));

create policy artist_leads_insert_own on public.artist_leads
    for insert to authenticated
    with check (artist_user_id = (select auth.uid()));

create policy artist_leads_update_own on public.artist_leads
    for update to authenticated
    using (artist_user_id = (select auth.uid()))
    with check (artist_user_id = (select auth.uid()));

create policy artist_leads_delete_own on public.artist_leads
    for delete to authenticated
    using (artist_user_id = (select auth.uid()));

grant select, insert, update, delete on table public.artist_leads to authenticated;

create trigger update_artist_leads_updated_at
    before update on public.artist_leads
    for each row
    execute function public.update_updated_at_column();
