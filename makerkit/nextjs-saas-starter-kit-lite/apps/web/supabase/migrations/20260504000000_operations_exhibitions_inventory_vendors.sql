/*
 * Operations: exhibition object planning, artwork locations, vendor directory.
 * Additive only — no drop table; extends provenance_events.event_type.
 */

-- ---------------------------------------------------------------------------
-- Exhibition object plans (owner-centric; optional link to public.exhibitions)
-- ---------------------------------------------------------------------------
create table if not exists public.exhibition_object_plans (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  exhibition_id uuid references public.exhibitions(id) on delete set null,
  exhibition_title text,
  venue_name text,
  venue_location text,
  install_date date,
  deinstall_date date,
  object_label text,
  lender_name text,
  lender_email text,
  lender_user_id uuid references auth.users(id) on delete set null,
  curator_name text,
  curator_email text,
  curator_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'planning'
    check (status in ('planning', 'confirmed', 'installed', 'closed', 'cancelled')),
  notes text,
  document_storage_path text,
  alert_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.exhibition_object_plans is 'Exhibition planning & object scheduling (Operations)';

create index if not exists exhibition_object_plans_account_created_idx
  on public.exhibition_object_plans (account_id, created_at desc);

create index if not exists exhibition_object_plans_lender_user_idx
  on public.exhibition_object_plans (lender_user_id)
  where lender_user_id is not null;

create index if not exists exhibition_object_plans_curator_user_idx
  on public.exhibition_object_plans (curator_user_id)
  where curator_user_id is not null;

alter table public.exhibition_object_plans enable row level security;

drop policy if exists exhibition_object_plans_select_own on public.exhibition_object_plans;
create policy exhibition_object_plans_select_own on public.exhibition_object_plans
  for select to authenticated
  using (account_id = (select auth.uid()));

drop policy if exists exhibition_object_plans_lender_select on public.exhibition_object_plans;
create policy exhibition_object_plans_lender_select on public.exhibition_object_plans
  for select to authenticated
  using (lender_user_id = (select auth.uid()));

drop policy if exists exhibition_object_plans_curator_select on public.exhibition_object_plans;
create policy exhibition_object_plans_curator_select on public.exhibition_object_plans
  for select to authenticated
  using (curator_user_id = (select auth.uid()));

drop policy if exists exhibition_object_plans_insert_own on public.exhibition_object_plans;
create policy exhibition_object_plans_insert_own on public.exhibition_object_plans
  for insert to authenticated
  with check (account_id = (select auth.uid()));

drop policy if exists exhibition_object_plans_update_own on public.exhibition_object_plans;
create policy exhibition_object_plans_update_own on public.exhibition_object_plans
  for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

drop policy if exists exhibition_object_plans_delete_own on public.exhibition_object_plans;
create policy exhibition_object_plans_delete_own on public.exhibition_object_plans
  for delete to authenticated
  using (account_id = (select auth.uid()));

grant select, insert, update, delete on public.exhibition_object_plans to authenticated;

drop trigger if exists update_exhibition_object_plans_updated_at on public.exhibition_object_plans;
create trigger update_exhibition_object_plans_updated_at
  before update on public.exhibition_object_plans
  for each row
  execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Artwork locations (inventory)
-- ---------------------------------------------------------------------------
create table if not exists public.artwork_locations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  location_type text not null default 'storage'
    check (location_type in ('storage', 'exhibition', 'loan', 'on_display', 'transport', 'studio')),
  location_name text,
  room text,
  shelf text,
  crate_label text,
  custodian_name text,
  custodian_email text,
  custodian_user_id uuid references auth.users(id) on delete set null,
  moved_at date,
  status text not null default 'current'
    check (status in ('current', 'historical')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.artwork_locations is 'Inventory & location tracking (Operations)';

create index if not exists artwork_locations_account_created_idx
  on public.artwork_locations (account_id, created_at desc);

create index if not exists artwork_locations_custodian_user_idx
  on public.artwork_locations (custodian_user_id)
  where custodian_user_id is not null;

alter table public.artwork_locations enable row level security;

drop policy if exists artwork_locations_select_own on public.artwork_locations;
create policy artwork_locations_select_own on public.artwork_locations
  for select to authenticated
  using (account_id = (select auth.uid()));

drop policy if exists artwork_locations_custodian_select on public.artwork_locations;
create policy artwork_locations_custodian_select on public.artwork_locations
  for select to authenticated
  using (custodian_user_id = (select auth.uid()));

drop policy if exists artwork_locations_insert_own on public.artwork_locations;
create policy artwork_locations_insert_own on public.artwork_locations
  for insert to authenticated
  with check (account_id = (select auth.uid()));

drop policy if exists artwork_locations_update_own on public.artwork_locations;
create policy artwork_locations_update_own on public.artwork_locations
  for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

drop policy if exists artwork_locations_delete_own on public.artwork_locations;
create policy artwork_locations_delete_own on public.artwork_locations
  for delete to authenticated
  using (account_id = (select auth.uid()));

grant select, insert, update, delete on public.artwork_locations to authenticated;

drop trigger if exists update_artwork_locations_updated_at on public.artwork_locations;
create trigger update_artwork_locations_updated_at
  before update on public.artwork_locations
  for each row
  execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Vendors (partner directory; not artwork-scoped)
-- ---------------------------------------------------------------------------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  service_type text not null default 'other'
    check (service_type in (
      'framer', 'shipper', 'conservator', 'photographer', 'handler',
      'installer', 'registrar', 'other'
    )),
  contact_name text,
  contact_email text,
  contact_user_id uuid references auth.users(id) on delete set null,
  phone text,
  website text,
  address text,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vendors is 'Vendor & partner directory (Operations)';

create index if not exists vendors_account_created_idx
  on public.vendors (account_id, created_at desc);

create index if not exists vendors_contact_user_idx
  on public.vendors (contact_user_id)
  where contact_user_id is not null;

alter table public.vendors enable row level security;

drop policy if exists vendors_select_own on public.vendors;
create policy vendors_select_own on public.vendors
  for select to authenticated
  using (account_id = (select auth.uid()));

drop policy if exists vendors_contact_select on public.vendors;
create policy vendors_contact_select on public.vendors
  for select to authenticated
  using (contact_user_id = (select auth.uid()));

drop policy if exists vendors_insert_own on public.vendors;
create policy vendors_insert_own on public.vendors
  for insert to authenticated
  with check (account_id = (select auth.uid()));

drop policy if exists vendors_update_own on public.vendors;
create policy vendors_update_own on public.vendors
  for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

drop policy if exists vendors_delete_own on public.vendors;
create policy vendors_delete_own on public.vendors
  for delete to authenticated
  using (account_id = (select auth.uid()));

grant select, insert, update, delete on public.vendors to authenticated;

drop trigger if exists update_vendors_updated_at on public.vendors;
create trigger update_vendors_updated_at
  before update on public.vendors
  for each row
  execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- provenance_events: extend event_type
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
    'artwork_location_updated'
  ));

comment on table public.provenance_events is
  'Structured provenance; includes operations loans, consignments, shipping, insurance, acquisitions, exhibitions, inventory';
