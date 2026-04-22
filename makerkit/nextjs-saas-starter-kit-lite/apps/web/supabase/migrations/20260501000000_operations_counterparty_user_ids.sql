/*
 * Operations: link counterparty Provenance users on loan / consignment records.
 * - Adds user id columns; counterparties can SELECT their linked rows.
 * - No destructive operations; only ADD COLUMN IF NOT EXISTS and policies.
 */

-- artwork_loan_agreements: borrower and lender may be linked Provenance users
alter table public.artwork_loan_agreements
  add column if not exists borrower_user_id uuid references auth.users(id) on delete set null;

alter table public.artwork_loan_agreements
  add column if not exists lender_user_id uuid references auth.users(id) on delete set null;

comment on column public.artwork_loan_agreements.borrower_user_id is
  'Linked Provenance user when borrower email matches a registered account';
comment on column public.artwork_loan_agreements.lender_user_id is
  'Linked Provenance user when lender email matches a registered account';

-- consignments: consignee may be a linked Provenance user
alter table public.consignments
  add column if not exists consignee_user_id uuid references auth.users(id) on delete set null;

comment on column public.consignments.consignee_user_id is
  'Linked Provenance user when consignee email matches a registered account';

create index if not exists artwork_loan_agreements_borrower_user_id_idx
  on public.artwork_loan_agreements (borrower_user_id)
  where borrower_user_id is not null;

create index if not exists artwork_loan_agreements_lender_user_id_idx
  on public.artwork_loan_agreements (lender_user_id)
  where lender_user_id is not null;

create index if not exists consignments_consignee_user_id_idx
  on public.consignments (consignee_user_id)
  where consignee_user_id is not null;

-- Counterparties can read records they are linked to (additive with existing owner policies)
drop policy if exists artwork_loan_agreements_borrower_select on public.artwork_loan_agreements;
create policy artwork_loan_agreements_borrower_select on public.artwork_loan_agreements
  for select to authenticated
  using (borrower_user_id = (select auth.uid()));

drop policy if exists artwork_loan_agreements_lender_select on public.artwork_loan_agreements;
create policy artwork_loan_agreements_lender_select on public.artwork_loan_agreements
  for select to authenticated
  using (lender_user_id = (select auth.uid()));

drop policy if exists consignments_consignee_select on public.consignments;
create policy consignments_consignee_select on public.consignments
  for select to authenticated
  using (consignee_user_id = (select auth.uid()));
