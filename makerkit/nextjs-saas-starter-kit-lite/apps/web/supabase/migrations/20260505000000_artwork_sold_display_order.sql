-- migration: 20260505000000_artwork_sold_display_order
-- Adds is_sold (boolean) and display_order (integer) to artworks,
-- extends provenance_events.event_type with 'sale'.
-- Additive only — no drop table.

-- ---------------------------------------------------------------------------
-- artworks: new columns
-- ---------------------------------------------------------------------------
alter table public.artworks
  add column if not exists is_sold boolean not null default false,
  add column if not exists display_order integer;

comment on column public.artworks.is_sold is
  'True when the owner has marked the artwork as sold via the collection UI.';
comment on column public.artworks.display_order is
  'Optional integer used to sort artworks within a collection (exhibition order). Nulls appear last.';

-- Index makes ORDER BY (display_order nulls last, created_at desc) fast per-account
create index if not exists artworks_display_order_idx
  on public.artworks (account_id, display_order nulls last, created_at desc);

-- ---------------------------------------------------------------------------
-- provenance_events: extend event_type to include 'sale'
-- ---------------------------------------------------------------------------
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
      and t.relname = 'provenance_events'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%event_type%'
  loop
    execute format('alter table public.provenance_events drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.provenance_events
  add constraint provenance_events_event_type_check
  check (event_type in (
    'ownership_transfer',
    'exhibition',
    'authentication',
    'coa_issued',
    'coo_issued',
    'cos_issued',
    'loan_out',
    'loan_return',
    'consignment_active',
    'consignment_sold',
    'consignment_returned',
    'artwork_shipped',
    'artwork_received',
    'insurance_active',
    'insurance_expired',
    'artwork_accessioned',
    'exhibition_object_confirmed',
    'exhibition_object_installed',
    'artwork_location_updated',
    'sale'
  ));

comment on table public.provenance_events is
  'Structured provenance; includes operations loans, consignments, shipping, insurance, acquisitions, exhibitions, inventory, and sale events';
