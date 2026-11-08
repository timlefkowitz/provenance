-- Linked certificates (CoA / CoS / CoO) now mirror provenance edits to each
-- other. Each mirrored write is logged as a 'provenance_synced' event whose
-- metadata says which certificate it came from and how (edit, sale, ...).

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
    'sale',
    'provenance_synced'
  ));
