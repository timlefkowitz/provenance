-- Migration: artwork inquire & sale
-- Adds per-artwork sales settings, an artwork_inquiries table, and
-- a stripe_connect_accounts table for Stripe Connect onboarding.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Extend public.artworks with sale / inquiry columns
-- ────────────────────────────────────────────────────────────────────────────
alter table public.artworks
  add column if not exists inquire_enabled   boolean           not null default true,
  add column if not exists for_sale          boolean           not null default false,
  add column if not exists sale_price        numeric(12,2),
  add column if not exists sale_currency     text              not null default 'usd',
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id   text,
  add column if not exists sold_at           timestamptz;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. public.artwork_inquiries — visitor inquiries and purchase receipts
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.artwork_inquiries (
  id                uuid        primary key default extensions.uuid_generate_v4(),
  artwork_id        uuid        not null references public.artworks(id) on delete cascade,
  owner_account_id  uuid        not null references public.accounts(id) on delete cascade,
  name              text        not null,
  email             text        not null,
  message           text,
  inquiry_type      text        not null check (inquiry_type in ('inquire', 'purchase')),
  stripe_session_id text,
  status            text        not null default 'pending'
                                check (status in ('pending', 'contacted', 'sold', 'closed')),
  created_at        timestamptz not null default now()
);

-- Owners can read and update their inquiries; anyone can insert (no auth needed for visitors)
alter table public.artwork_inquiries enable row level security;

drop policy if exists "owners_select_artwork_inquiries" on public.artwork_inquiries;
create policy "owners_select_artwork_inquiries"
  on public.artwork_inquiries for select
  using (auth.uid() = owner_account_id);

drop policy if exists "owners_update_artwork_inquiries" on public.artwork_inquiries;
create policy "owners_update_artwork_inquiries"
  on public.artwork_inquiries for update
  using (auth.uid() = owner_account_id)
  with check (auth.uid() = owner_account_id);

-- Public insert: visitors can insert, but only when the owner_account_id matches
-- the real owner of the target artwork, and that artwork is public & accepts inquiries.
-- This prevents direct-API abuse where a caller picks an arbitrary owner_account_id.
drop policy if exists "public_insert_artwork_inquiries" on public.artwork_inquiries;
create policy "public_insert_artwork_inquiries"
  on public.artwork_inquiries for insert
  with check (
    exists (
      select 1
      from public.artworks a
      where a.id           = artwork_id
        and a.account_id   = owner_account_id
        and a.status       = 'verified'
        and a.is_public    = true
        and a.inquire_enabled = true
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 3. public.stripe_connect_accounts — seller Stripe Connect state
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.stripe_connect_accounts (
  user_id             uuid        primary key references auth.users(id) on delete cascade,
  stripe_account_id   text        not null,
  charges_enabled     boolean     not null default false,
  details_submitted   boolean     not null default false,
  payouts_enabled     boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.stripe_connect_accounts enable row level security;

-- Owners can read their own connect account; writes go through admin client only
drop policy if exists "owners_select_stripe_connect_accounts" on public.stripe_connect_accounts;
create policy "owners_select_stripe_connect_accounts"
  on public.stripe_connect_accounts for select
  using (auth.uid() = user_id);

-- Index for fast lookup
create index if not exists idx_artwork_inquiries_artwork_id
  on public.artwork_inquiries (artwork_id);

create index if not exists idx_artwork_inquiries_owner_account_id
  on public.artwork_inquiries (owner_account_id);
