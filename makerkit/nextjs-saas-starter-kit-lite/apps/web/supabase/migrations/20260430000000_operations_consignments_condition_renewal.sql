/*
 * Operations toolbox: consignments, condition reports, loan renewals & alerts.
 * Adds: public.consignments, public.condition_reports, columns on artwork_loan_agreements,
 * and extends provenance_events.event_type for loan / consignment audit trail.
 */

-- ---------------------------------------------------------------------------
-- Consignments (per-account, same RLS as loans)
-- ---------------------------------------------------------------------------
create table if not exists public.consignments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  consignee_name text not null default '',
  consignee_email text,
  start_date date,
  end_date date,
  commission_rate_bps integer,
  reserve_price_cents bigint check (reserve_price_cents is null or reserve_price_cents >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'expired', 'returned', 'sold')),
  terms_text text,
  notes text,
  document_storage_path text,
  sold_at timestamptz,
  sale_price_cents bigint check (sale_price_cents is null or sale_price_cents >= 0),
  alert_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.consignments is 'Consignment agreements for Operations toolbox';
comment on column public.consignments.commission_rate_bps is 'Commission in basis points (e.g. 5000 = 50%)';
comment on column public.consignments.alert_sent_at is 'Set when 30-day expiry notification was sent';

create index if not exists consignments_account_created_idx
  on public.consignments (account_id, created_at desc);

create index if not exists consignments_account_artwork_idx
  on public.consignments (account_id, artwork_id);

alter table public.consignments enable row level security;

drop policy if exists consignments_select_own on public.consignments;
create policy consignments_select_own on public.consignments
  for select to authenticated
  using (account_id = (select auth.uid()));

drop policy if exists consignments_insert_own on public.consignments;
create policy consignments_insert_own on public.consignments
  for insert to authenticated
  with check (account_id = (select auth.uid()));

drop policy if exists consignments_update_own on public.consignments;
create policy consignments_update_own on public.consignments
  for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

drop policy if exists consignments_delete_own on public.consignments;
create policy consignments_delete_own on public.consignments
  for delete to authenticated
  using (account_id = (select auth.uid()));

grant select, insert, update, delete on public.consignments to authenticated;

drop trigger if exists update_consignments_updated_at on public.consignments;
create trigger update_consignments_updated_at
  before update on public.consignments
  for each row
  execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Artwork loan agreements: renewal + expiry alert tracking
-- ---------------------------------------------------------------------------
alter table public.artwork_loan_agreements
  add column if not exists renewal_count integer not null default 0 check (renewal_count >= 0);

alter table public.artwork_loan_agreements
  add column if not exists original_loan_id uuid references public.artwork_loan_agreements(id) on delete set null;

alter table public.artwork_loan_agreements
  add column if not exists alert_sent_at timestamptz;

comment on column public.artwork_loan_agreements.original_loan_id is 'Prior agreement when this row is a renewal';
comment on column public.artwork_loan_agreements.alert_sent_at is 'Set when 30-day expiry notification was sent';

create index if not exists artwork_loan_agreements_original_loan_id_idx
  on public.artwork_loan_agreements (original_loan_id)
  where original_loan_id is not null;

-- ---------------------------------------------------------------------------
-- Condition reports
-- ---------------------------------------------------------------------------
create table if not exists public.condition_reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  loan_agreement_id uuid references public.artwork_loan_agreements(id) on delete set null,
  consignment_id uuid references public.consignments(id) on delete set null,
  report_type text not null default 'initial'
    check (report_type in ('initial', 'return', 'periodic')),
  condition_grade text
    check (condition_grade is null or condition_grade in ('excellent', 'good', 'fair', 'poor')),
  description text,
  inspector_name text,
  inspection_date date,
  attachments_storage_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.condition_reports is 'Condition and conservation reports for Operations toolbox';

create index if not exists condition_reports_account_created_idx
  on public.condition_reports (account_id, created_at desc);

create index if not exists condition_reports_artwork_idx
  on public.condition_reports (artwork_id, created_at desc);

alter table public.condition_reports enable row level security;

drop policy if exists condition_reports_select_own on public.condition_reports;
create policy condition_reports_select_own on public.condition_reports
  for select to authenticated
  using (account_id = (select auth.uid()));

drop policy if exists condition_reports_insert_own on public.condition_reports;
create policy condition_reports_insert_own on public.condition_reports
  for insert to authenticated
  with check (account_id = (select auth.uid()));

drop policy if exists condition_reports_update_own on public.condition_reports;
create policy condition_reports_update_own on public.condition_reports
  for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

drop policy if exists condition_reports_delete_own on public.condition_reports;
create policy condition_reports_delete_own on public.condition_reports
  for delete to authenticated
  using (account_id = (select auth.uid()));

grant select, insert, update, delete on public.condition_reports to authenticated;

-- ---------------------------------------------------------------------------
-- Extend provenance_events.event_type for operations audit trail
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
    'consignment_returned'
  ));

comment on table public.provenance_events is
  'Structured provenance history; includes loans/consignments via loan_out, loan_return, consignment_*';

-- ---------------------------------------------------------------------------
-- Loan agreement status: allow "expired" (cron: past end_date, was active)
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
      and t.relname = 'artwork_loan_agreements'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.artwork_loan_agreements drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.artwork_loan_agreements
  add constraint artwork_loan_agreements_status_check
  check (status in (
    'draft', 'sent', 'signed', 'active', 'closed', 'expired'
  ));
