-- Seller payouts: buyers pay Provenance's Stripe account, we keep a platform
-- fee and transfer the rest to the seller's platform-controlled connected
-- account (sellers never create or log into a Stripe account).

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Connect account kind: legacy self-onboarded Express vs. invisible
--    platform-controlled accounts created by ensurePayoutAccount().
-- ────────────────────────────────────────────────────────────────────────────
alter table public.stripe_connect_accounts
  add column if not exists account_kind text not null default 'express'
    check (account_kind in ('express', 'platform'));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Hold a work while a buyer is in Checkout so two buyers can't pay for it.
-- ────────────────────────────────────────────────────────────────────────────
alter table public.artworks
  add column if not exists checkout_reserved_until timestamptz;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. public.seller_earnings — one row per paid sale, tracks the seller's cut
--    from charge to transfer.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.seller_earnings (
  id                    uuid        primary key default gen_random_uuid(),
  seller_account_id     uuid        not null references auth.users(id) on delete restrict,
  artwork_id            uuid        references public.artworks(id) on delete set null,
  artwork_title         text,
  checkout_session_id   text        not null unique,
  payment_intent_id     text,
  charge_id             text,
  gross_cents           integer     not null check (gross_cents >= 0),
  platform_fee_cents    integer     not null check (platform_fee_cents >= 0),
  stripe_fee_cents      integer     not null check (stripe_fee_cents >= 0),
  net_cents             integer     not null check (net_cents >= 0),
  currency              text        not null default 'usd',
  status                text        not null default 'pending'
    check (status in ('pending', 'held', 'transferred', 'reversed')),
  release_at            timestamptz not null,
  transfer_id           text,
  transferred_at        timestamptz,
  held_reason           text,
  last_error            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_seller_earnings_seller
  on public.seller_earnings (seller_account_id, created_at desc);
create index if not exists idx_seller_earnings_due
  on public.seller_earnings (release_at)
  where status = 'pending';
create index if not exists idx_seller_earnings_charge
  on public.seller_earnings (charge_id);

alter table public.seller_earnings enable row level security;

-- Sellers can read their own earnings; all writes go through the admin client.
drop policy if exists "sellers_select_own_earnings" on public.seller_earnings;
create policy "sellers_select_own_earnings"
  on public.seller_earnings for select
  using (auth.uid() = seller_account_id);

revoke all on public.seller_earnings from anon;
grant select on public.seller_earnings to authenticated;
grant all on public.seller_earnings to service_role;
