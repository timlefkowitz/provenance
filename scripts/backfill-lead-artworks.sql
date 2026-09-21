-- Backfill artwork links for mailing-list contacts created BEFORE contacts stored their artwork.
-- Requires migration 20260921000100_artist_lead_artworks.sql.
--
-- HOW TO RUN (Supabase SQL editor): run STEP 1 and read the result. Only if it looks right,
-- run STEP 2. STEP 3 is preview-only and never writes.
--
-- DATA-SAFE: STEP 2 only INSERTS rows into artist_lead_artworks (on conflict do nothing, so it
-- is safe to re-run). It never updates or deletes artist_leads or any other data.

-- ─── STEP 1: preview (read-only) ─────────────────────────────────────────────
-- Contacts whose notes came from "Artist claim invite sent — artwork <uuid>". The artwork id was
-- written by our own code, so these matches are exact. Only artworks that still exist are listed.
select
  l.id as lead_id,
  coalesce(l.contact_name, l.contact_email) as contact,
  a.id as artwork_id,
  a.title as artwork_title
from public.artist_leads l
cross join lateral (
  select substring(l.notes from 'artwork ([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')::uuid as id
) n
join public.artworks a on a.id = n.id
where l.notes like 'Artist claim invite sent — artwork %'
  and not exists (
    select 1 from public.artist_lead_artworks x where x.lead_id = l.id and x.artwork_id = a.id
  )
order by contact;

-- ─── STEP 2: apply (writes link rows only) ───────────────────────────────────
-- Uncomment after checking STEP 1.
--
-- insert into public.artist_lead_artworks (lead_id, artwork_id, source)
-- select l.id, a.id, l.source
-- from public.artist_leads l
-- cross join lateral (
--   select substring(l.notes from 'artwork ([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')::uuid as id
-- ) n
-- join public.artworks a on a.id = n.id
-- where l.notes like 'Artist claim invite sent — artwork %'
-- on conflict do nothing;

-- ─── STEP 3: sale / certificate contacts matched by TITLE (preview only, never writes) ──
-- Notes like "Marked sold — <title>" only store a title. This lists contacts where the artist owns
-- exactly ONE artwork with that exact title. Caveat: a sold work may have moved to the buyer's
-- account, so it will not appear here; and duplicate titles are excluded on purpose. Review by
-- hand and link the ones you are sure about; this script intentionally does not write them.
select
  l.id as lead_id,
  coalesce(l.contact_name, l.contact_email) as contact,
  l.notes,
  min(a.id::text) as artwork_id
from public.artist_leads l
join public.artworks a
  on a.account_id = l.artist_user_id
 and l.notes in (
       'Marked sold — ' || a.title,
       'Certificate of ownership — ' || a.title,
       'Certificate of ownership invite — ' || a.title
     )
where l.artwork_id is null
  and not exists (select 1 from public.artist_lead_artworks x where x.lead_id = l.id)
group by l.id, l.contact_name, l.contact_email, l.notes
having count(*) = 1
order by contact;
