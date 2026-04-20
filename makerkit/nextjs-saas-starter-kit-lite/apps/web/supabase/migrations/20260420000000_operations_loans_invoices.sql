/*
 * Operations: artwork loan agreements and invoices (per-account, RLS).
 *
 * DATA SAFETY (this migration does NOT wipe or modify existing user content):
 * - No DELETE, TRUNCATE, or DROP TABLE on any pre-existing table.
 * - No ALTER TABLE on public.accounts, public.artworks, or other legacy tables.
 * - Only creates NEW tables: artwork_loan_agreements, invoices, invoice_line_items
 *   (each with CREATE TABLE IF NOT EXISTS).
 * - CREATE INDEX IF NOT EXISTS only on those new tables.
 * - DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS apply only to the new table names
 *   above, then policies/triggers are recreated (idempotent re-run; row data untouched).
 * - Foreign keys reference accounts/artworks/invoices for integrity only; applying
 *   this migration does not cascade-delete existing artwork or account rows.
 */

-- Loan agreements tied to artworks the account owns (account_id enforced in app + RLS)
create table if not exists public.artwork_loan_agreements (
    id uuid primary key default extensions.uuid_generate_v4(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    artwork_id uuid not null references public.artworks(id) on delete cascade,
    borrower_name text not null default '',
    borrower_email text,
    lender_name text,
    lender_email text,
    start_date date,
    end_date date,
    terms_text text,
    conditions_text text,
    insurance_requirements_text text,
    status text not null default 'draft'
        check (status in ('draft', 'sent', 'signed', 'active', 'closed')),
    signature_completed_at timestamp with time zone,
    signature_notes text,
    document_storage_path text,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

comment on table public.artwork_loan_agreements is 'Artwork loan agreements for Operations toolbox';

create index if not exists artwork_loan_agreements_account_created_idx
    on public.artwork_loan_agreements (account_id, created_at desc);

alter table public.artwork_loan_agreements enable row level security;

drop policy if exists artwork_loan_agreements_select_own on public.artwork_loan_agreements;
create policy artwork_loan_agreements_select_own on public.artwork_loan_agreements
    for select to authenticated
    using (account_id = (select auth.uid()));

drop policy if exists artwork_loan_agreements_insert_own on public.artwork_loan_agreements;
create policy artwork_loan_agreements_insert_own on public.artwork_loan_agreements
    for insert to authenticated
    with check (account_id = (select auth.uid()));

drop policy if exists artwork_loan_agreements_update_own on public.artwork_loan_agreements;
create policy artwork_loan_agreements_update_own on public.artwork_loan_agreements
    for update to authenticated
    using (account_id = (select auth.uid()))
    with check (account_id = (select auth.uid()));

drop policy if exists artwork_loan_agreements_delete_own on public.artwork_loan_agreements;
create policy artwork_loan_agreements_delete_own on public.artwork_loan_agreements
    for delete to authenticated
    using (account_id = (select auth.uid()));

grant select, insert, update, delete on public.artwork_loan_agreements to authenticated;

drop trigger if exists update_artwork_loan_agreements_updated_at on public.artwork_loan_agreements;
create trigger update_artwork_loan_agreements_updated_at
    before update on public.artwork_loan_agreements
    for each row
    execute function public.update_updated_at_column();

-- Invoices
create table if not exists public.invoices (
    id uuid primary key default extensions.uuid_generate_v4(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    invoice_number text not null,
    client_name text not null default '',
    client_email text,
    status text not null default 'draft'
        check (status in ('draft', 'sent', 'partial', 'paid', 'overdue')),
    currency text not null default 'USD',
    due_date date,
    tax_cents integer not null default 0 check (tax_cents >= 0),
    notes text,
    artwork_id uuid references public.artworks(id) on delete set null,
    sent_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    unique (account_id, invoice_number)
);

comment on table public.invoices is 'Invoices for Operations toolbox';

create index if not exists invoices_account_created_idx
    on public.invoices (account_id, created_at desc);

alter table public.invoices enable row level security;

drop policy if exists invoices_select_own on public.invoices;
create policy invoices_select_own on public.invoices
    for select to authenticated
    using (account_id = (select auth.uid()));

drop policy if exists invoices_insert_own on public.invoices;
create policy invoices_insert_own on public.invoices
    for insert to authenticated
    with check (account_id = (select auth.uid()));

drop policy if exists invoices_update_own on public.invoices;
create policy invoices_update_own on public.invoices
    for update to authenticated
    using (account_id = (select auth.uid()))
    with check (account_id = (select auth.uid()));

drop policy if exists invoices_delete_own on public.invoices;
create policy invoices_delete_own on public.invoices
    for delete to authenticated
    using (account_id = (select auth.uid()));

grant select, insert, update, delete on public.invoices to authenticated;

drop trigger if exists update_invoices_updated_at on public.invoices;
create trigger update_invoices_updated_at
    before update on public.invoices
    for each row
    execute function public.update_updated_at_column();

-- Invoice line items
create table if not exists public.invoice_line_items (
    id uuid primary key default extensions.uuid_generate_v4(),
    invoice_id uuid not null references public.invoices(id) on delete cascade,
    description text not null default '',
    quantity numeric not null default 1 check (quantity > 0),
    unit_amount_cents integer not null check (unit_amount_cents >= 0),
    sort_order integer not null default 0,
    created_at timestamp with time zone default now() not null
);

comment on table public.invoice_line_items is 'Line items for invoices';

create index if not exists invoice_line_items_invoice_idx
    on public.invoice_line_items (invoice_id, sort_order);

alter table public.invoice_line_items enable row level security;

drop policy if exists invoice_line_items_select on public.invoice_line_items;
create policy invoice_line_items_select on public.invoice_line_items
    for select to authenticated
    using (
        exists (
            select 1 from public.invoices i
            where i.id = invoice_id and i.account_id = (select auth.uid())
        )
    );

drop policy if exists invoice_line_items_insert on public.invoice_line_items;
create policy invoice_line_items_insert on public.invoice_line_items
    for insert to authenticated
    with check (
        exists (
            select 1 from public.invoices i
            where i.id = invoice_id and i.account_id = (select auth.uid())
        )
    );

drop policy if exists invoice_line_items_update on public.invoice_line_items;
create policy invoice_line_items_update on public.invoice_line_items
    for update to authenticated
    using (
        exists (
            select 1 from public.invoices i
            where i.id = invoice_id and i.account_id = (select auth.uid())
        )
    )
    with check (
        exists (
            select 1 from public.invoices i
            where i.id = invoice_id and i.account_id = (select auth.uid())
        )
    );

drop policy if exists invoice_line_items_delete on public.invoice_line_items;
create policy invoice_line_items_delete on public.invoice_line_items
    for delete to authenticated
    using (
        exists (
            select 1 from public.invoices i
            where i.id = invoice_id and i.account_id = (select auth.uid())
        )
    );

grant select, insert, update, delete on public.invoice_line_items to authenticated;
