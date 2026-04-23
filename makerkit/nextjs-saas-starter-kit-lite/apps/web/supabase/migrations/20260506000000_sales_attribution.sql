-- migration: 20260506000000_sales_attribution
-- Adds structured sold-by / sold-to attribution to artworks, and a
-- sales_ledger table that is the canonical structured record of sales.
-- Additive only.

-- ---------------------------------------------------------------------------
-- artworks: new structured sale columns
-- ---------------------------------------------------------------------------
alter table public.artworks
  add column if not exists sold_by_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists sold_to_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists sold_to_email text,
  add column if not exists sold_to_name text,
  add column if not exists sold_price_cents bigint,
  add column if not exists sold_currency text default 'USD',
  add column if not exists sold_at timestamptz;

comment on column public.artworks.sold_by_account_id is
  'Platform account (gallery / institution / user) that sold this artwork. Free-text sold_by column is kept as display fallback.';
comment on column public.artworks.sold_to_account_id is
  'Platform account that acquired this artwork. Null if the buyer is off-platform or not yet invited.';
comment on column public.artworks.sold_to_email is
  'Email of the buyer when not yet on the platform; used to send an ownership transfer invite.';
comment on column public.artworks.sold_to_name is
  'Display name for a fully off-platform buyer when neither an account nor email is provided.';
comment on column public.artworks.sold_price_cents is
  'Sale price in minor units (cents). Optional.';

create index if not exists artworks_sold_by_account_id_idx
  on public.artworks (sold_by_account_id, sold_at desc)
  where sold_by_account_id is not null;
create index if not exists artworks_sold_to_account_id_idx
  on public.artworks (sold_to_account_id, sold_at desc)
  where sold_to_account_id is not null;

-- ---------------------------------------------------------------------------
-- sales_ledger: structured append-only sale records
-- ---------------------------------------------------------------------------
create table if not exists public.sales_ledger (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  sold_by_account_id uuid references public.accounts(id) on delete set null,
  sold_to_account_id uuid references public.accounts(id) on delete set null,
  sold_to_email text,
  sold_to_name text,
  price_cents bigint,
  currency text not null default 'USD',
  sold_at timestamptz not null default now(),
  recorded_by uuid references public.accounts(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.sales_ledger is
  'Canonical structured sale records. Separate from provenance_events (which remains the immutable audit log).';

create index if not exists sales_ledger_sold_by_idx
  on public.sales_ledger (sold_by_account_id, sold_at desc)
  where sold_by_account_id is not null;
create index if not exists sales_ledger_sold_to_idx
  on public.sales_ledger (sold_to_account_id, sold_at desc)
  where sold_to_account_id is not null;
create index if not exists sales_ledger_artwork_idx
  on public.sales_ledger (artwork_id, sold_at desc);

alter table public.sales_ledger enable row level security;

-- SELECT: artwork owner, seller, or buyer can read their rows
drop policy if exists sales_ledger_select_participants on public.sales_ledger;
create policy sales_ledger_select_participants on public.sales_ledger
  for select
  to authenticated
  using (
    sold_by_account_id = (select auth.uid())
    or sold_to_account_id = (select auth.uid())
    or exists (
      select 1 from public.artworks a
      where a.id = sales_ledger.artwork_id
        and a.account_id = (select auth.uid())
    )
  );

-- INSERT is performed via a server action using the admin client (service_role
-- bypasses RLS). No INSERT policy for regular users.

grant select on table public.sales_ledger to authenticated;
