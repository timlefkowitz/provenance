/*
 * Operations: artwork shipments, insurance/valuations, acquisitions.
 * Additive only — no drop table; extends provenance_events.event_type.
 */

-- ---------------------------------------------------------------------------
-- Artwork shipments
-- ---------------------------------------------------------------------------
create table if not exists public.artwork_shipments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  courier_name text not null default '',
  courier_contact_email text,
  courier_user_id uuid references auth.users(id) on delete set null,
  origin_location text,
  destination_location text,
  ship_date date,
  estimated_arrival date,
  actual_arrival date,
  tracking_number text,
  transit_insurance_policy text,
  transit_insurance_value_cents bigint check (transit_insurance_value_cents is null or transit_insurance_value_cents >= 0),
  crating_notes text,
  status text not null default 'draft'
    check (status in ('draft', 'booked', 'in_transit', 'delivered', 'cancelled')),
  document_storage_path text,
  alert_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.artwork_shipments is 'Shipping & logistics for Operations';

create index if not exists artwork_shipments_account_created_idx
  on public.artwork_shipments (account_id, created_at desc);

create index if not exists artwork_shipments_account_artwork_idx
  on public.artwork_shipments (account_id, artwork_id);

create index if not exists artwork_shipments_courier_user_idx
  on public.artwork_shipments (courier_user_id)
  where courier_user_id is not null;

alter table public.artwork_shipments enable row level security;

drop policy if exists artwork_shipments_select_own on public.artwork_shipments;
create policy artwork_shipments_select_own on public.artwork_shipments
  for select to authenticated
  using (account_id = (select auth.uid()));

drop policy if exists artwork_shipments_courier_select on public.artwork_shipments;
create policy artwork_shipments_courier_select on public.artwork_shipments
  for select to authenticated
  using (courier_user_id = (select auth.uid()));

drop policy if exists artwork_shipments_insert_own on public.artwork_shipments;
create policy artwork_shipments_insert_own on public.artwork_shipments
  for insert to authenticated
  with check (account_id = (select auth.uid()));

drop policy if exists artwork_shipments_update_own on public.artwork_shipments;
create policy artwork_shipments_update_own on public.artwork_shipments
  for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

drop policy if exists artwork_shipments_delete_own on public.artwork_shipments;
create policy artwork_shipments_delete_own on public.artwork_shipments
  for delete to authenticated
  using (account_id = (select auth.uid()));

grant select, insert, update, delete on public.artwork_shipments to authenticated;

drop trigger if exists update_artwork_shipments_updated_at on public.artwork_shipments;
create trigger update_artwork_shipments_updated_at
  before update on public.artwork_shipments
  for each row
  execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Insurance & valuations
-- ---------------------------------------------------------------------------
create table if not exists public.insurance_valuations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  policy_number text,
  insurer_name text not null default '',
  insurer_contact_email text,
  insurer_user_id uuid references auth.users(id) on delete set null,
  coverage_amount_cents bigint check (coverage_amount_cents is null or coverage_amount_cents >= 0),
  currency text not null default 'USD',
  appraiser_name text,
  appraiser_email text,
  appraiser_user_id uuid references auth.users(id) on delete set null,
  appraisal_date date,
  policy_start_date date,
  policy_end_date date,
  valuation_notes text,
  status text not null default 'pending'
    check (status in ('active', 'expired', 'pending', 'cancelled')),
  document_storage_path text,
  alert_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.insurance_valuations is 'Insurance and appraisal records for Operations';

create index if not exists insurance_valuations_account_created_idx
  on public.insurance_valuations (account_id, created_at desc);

create index if not exists insurance_valuations_insurer_user_idx
  on public.insurance_valuations (insurer_user_id)
  where insurer_user_id is not null;

create index if not exists insurance_valuations_appraiser_user_idx
  on public.insurance_valuations (appraiser_user_id)
  where appraiser_user_id is not null;

alter table public.insurance_valuations enable row level security;

drop policy if exists insurance_valuations_select_own on public.insurance_valuations;
create policy insurance_valuations_select_own on public.insurance_valuations
  for select to authenticated
  using (account_id = (select auth.uid()));

drop policy if exists insurance_valuations_insurer_select on public.insurance_valuations;
create policy insurance_valuations_insurer_select on public.insurance_valuations
  for select to authenticated
  using (insurer_user_id = (select auth.uid()));

drop policy if exists insurance_valuations_appraiser_select on public.insurance_valuations;
create policy insurance_valuations_appraiser_select on public.insurance_valuations
  for select to authenticated
  using (appraiser_user_id = (select auth.uid()));

drop policy if exists insurance_valuations_insert_own on public.insurance_valuations;
create policy insurance_valuations_insert_own on public.insurance_valuations
  for insert to authenticated
  with check (account_id = (select auth.uid()));

drop policy if exists insurance_valuations_update_own on public.insurance_valuations;
create policy insurance_valuations_update_own on public.insurance_valuations
  for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

drop policy if exists insurance_valuations_delete_own on public.insurance_valuations;
create policy insurance_valuations_delete_own on public.insurance_valuations
  for delete to authenticated
  using (account_id = (select auth.uid()));

grant select, insert, update, delete on public.insurance_valuations to authenticated;

drop trigger if exists update_insurance_valuations_updated_at on public.insurance_valuations;
create trigger update_insurance_valuations_updated_at
  before update on public.insurance_valuations
  for each row
  execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Acquisitions
-- ---------------------------------------------------------------------------
create table if not exists public.acquisitions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  acquisition_type text not null default 'purchase'
    check (acquisition_type in ('purchase', 'gift', 'bequest', 'exchange', 'transfer')),
  seller_name text not null default '',
  seller_email text,
  seller_user_id uuid references auth.users(id) on delete set null,
  acquisition_price_cents bigint check (acquisition_price_cents is null or acquisition_price_cents >= 0),
  currency text not null default 'USD',
  acquisition_date date,
  provenance_notes text,
  accession_number text,
  legal_status text not null default 'under_review'
    check (legal_status in ('clear', 'under_review', 'encumbered')),
  fund_source text,
  status text not null default 'under_review'
    check (status in ('under_review', 'approved', 'accessioned', 'deaccessioned')),
  document_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.acquisitions is 'Acquisition and accession workflows for Operations';

create index if not exists acquisitions_account_created_idx
  on public.acquisitions (account_id, created_at desc);

create index if not exists acquisitions_seller_user_idx
  on public.acquisitions (seller_user_id)
  where seller_user_id is not null;

alter table public.acquisitions enable row level security;

drop policy if exists acquisitions_select_own on public.acquisitions;
create policy acquisitions_select_own on public.acquisitions
  for select to authenticated
  using (account_id = (select auth.uid()));

drop policy if exists acquisitions_seller_select on public.acquisitions;
create policy acquisitions_seller_select on public.acquisitions
  for select to authenticated
  using (seller_user_id = (select auth.uid()));

drop policy if exists acquisitions_insert_own on public.acquisitions;
create policy acquisitions_insert_own on public.acquisitions
  for insert to authenticated
  with check (account_id = (select auth.uid()));

drop policy if exists acquisitions_update_own on public.acquisitions;
create policy acquisitions_update_own on public.acquisitions
  for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

drop policy if exists acquisitions_delete_own on public.acquisitions;
create policy acquisitions_delete_own on public.acquisitions
  for delete to authenticated
  using (account_id = (select auth.uid()));

grant select, insert, update, delete on public.acquisitions to authenticated;

drop trigger if exists update_acquisitions_updated_at on public.acquisitions;
create trigger update_acquisitions_updated_at
  before update on public.acquisitions
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
    'artwork_accessioned'
  ));

comment on table public.provenance_events is
  'Structured provenance; includes operations loans, consignments, shipping, insurance, acquisitions';
