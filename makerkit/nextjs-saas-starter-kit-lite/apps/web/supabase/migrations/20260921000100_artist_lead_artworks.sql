/*
 * -------------------------------------------------------
 * Contact <-> artwork links (many-to-many)
 * A mailing-list contact can be linked to several artworks (repeat buyers,
 * batch certificate invites). artist_leads.artwork_id stays as the "first"
 * artwork for the CRM pipeline card; this table holds all of them.
 *
 * DATA-SAFE: additive only. New table; the backfill only READS artist_leads
 * and inserts link rows (on conflict do nothing, safe to re-run). Deleting a
 * contact or an artwork removes only its link rows.
 * -------------------------------------------------------
 */

create table if not exists public.artist_lead_artworks (
  lead_id uuid not null references public.artist_leads(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  source text,
  created_at timestamp with time zone not null default now(),
  primary key (lead_id, artwork_id)
);

comment on table public.artist_lead_artworks is 'Artworks a mailing-list contact / CRM lead is linked to (sale, certificate invite, inquiry…)';

create index if not exists artist_lead_artworks_artwork_id_idx on public.artist_lead_artworks(artwork_id);

alter table public.artist_lead_artworks enable row level security;

-- Access follows the contact: a link is visible / writable exactly when its artist_leads row is.
-- The subquery below runs as the calling user, so artist_leads' own RLS decides. That means this
-- works with the owner-only policies and keeps working unchanged if the CRM team-members
-- migration (is_crm_member) is applied later; it does not depend on that function existing.
drop policy if exists artist_lead_artworks_select on public.artist_lead_artworks;
drop policy if exists artist_lead_artworks_insert on public.artist_lead_artworks;
drop policy if exists artist_lead_artworks_delete on public.artist_lead_artworks;

create policy artist_lead_artworks_select on public.artist_lead_artworks
  for select to authenticated
  using (exists (select 1 from public.artist_leads l where l.id = lead_id));

create policy artist_lead_artworks_insert on public.artist_lead_artworks
  for insert to authenticated
  with check (exists (select 1 from public.artist_leads l where l.id = lead_id));

create policy artist_lead_artworks_delete on public.artist_lead_artworks
  for delete to authenticated
  using (exists (select 1 from public.artist_leads l where l.id = lead_id));

grant select, insert, delete on table public.artist_lead_artworks to authenticated;

-- Keep every link that already exists.
insert into public.artist_lead_artworks (lead_id, artwork_id, source)
select id, artwork_id, source
from public.artist_leads
where artwork_id is not null
on conflict do nothing;
