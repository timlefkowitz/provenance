/*
 * -------------------------------------------------------
 * Exhibition sales and carts
 *
 * A gallery can turn on online selling for an exhibition and set a
 * commission. Buyers put works from any show into one cart and pay once
 * through Stripe Checkout (Apple Pay / Google Pay / card). Each paid work is
 * split into seller_earnings rows: the artist's share and, when there is a
 * commission, the gallery's share.
 *
 * All writes to orders / order_items / seller_earnings go through the
 * service role. Buyers manage their own cart_items directly.
 * -------------------------------------------------------
 */

-- 1. Per-exhibition switch and commission
alter table public.exhibitions
  add column if not exists sales_enabled boolean not null default false,
  add column if not exists commission_percent numeric(5,2) not null default 0
    check (commission_percent >= 0 and commission_percent <= 100);

-- Per-show price, set by the show's managers on the work's link into the show
-- (so a gallery never edits the artist's own certificate to price it).
alter table public.exhibition_artworks
  add column if not exists for_sale boolean not null default false,
  add column if not exists sale_price_cents integer check (sale_price_cents is null or sale_price_cents > 0),
  add column if not exists sale_currency text not null default 'usd';

-- 2. Signed-in buyers' carts (guests keep theirs in the browser)
create table if not exists public.cart_items (
  id            uuid        primary key default gen_random_uuid(),
  account_id    uuid        not null references auth.users(id) on delete cascade,
  artwork_id    uuid        not null references public.artworks(id) on delete cascade,
  exhibition_id uuid        references public.exhibitions(id) on delete set null,
  added_at      timestamptz not null default now(),
  unique (account_id, artwork_id)
);

create index if not exists idx_cart_items_account on public.cart_items (account_id, added_at);

alter table public.cart_items enable row level security;

drop policy if exists "cart_items_select_own" on public.cart_items;
create policy "cart_items_select_own" on public.cart_items
  for select using (auth.uid() = account_id);
drop policy if exists "cart_items_insert_own" on public.cart_items;
create policy "cart_items_insert_own" on public.cart_items
  for insert with check (auth.uid() = account_id);
drop policy if exists "cart_items_delete_own" on public.cart_items;
create policy "cart_items_delete_own" on public.cart_items
  for delete using (auth.uid() = account_id);

revoke all on public.cart_items from anon;
grant select, insert, delete on public.cart_items to authenticated;
grant all on public.cart_items to service_role;

-- 3. Orders: one per Checkout session
create table if not exists public.orders (
  id                   uuid        primary key default gen_random_uuid(),
  checkout_session_id  text        unique,
  buyer_account_id     uuid        references auth.users(id) on delete set null,
  buyer_email          text,
  buyer_name           text,
  buyer_phone          text,
  -- Where to send the work, as collected by Stripe Checkout.
  shipping_details     jsonb,
  status               text        not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'refunded')),
  amount_total_cents   integer     not null check (amount_total_cents >= 0),
  currency             text        not null default 'usd',
  created_at           timestamptz not null default now(),
  paid_at              timestamptz,
  updated_at           timestamptz not null default now()
);

create index if not exists idx_orders_buyer on public.orders (buyer_account_id, created_at desc);

-- 4. What was bought and how each work splits, frozen at checkout
create table if not exists public.order_items (
  id                  uuid         primary key default gen_random_uuid(),
  order_id            uuid         not null references public.orders(id) on delete cascade,
  artwork_id          uuid         references public.artworks(id) on delete set null,
  artwork_title       text,
  exhibition_id       uuid         references public.exhibitions(id) on delete set null,
  price_cents         integer      not null check (price_cents >= 0),
  currency            text         not null default 'usd',
  artist_account_id   uuid         not null references auth.users(id) on delete restrict,
  gallery_account_id  uuid         references auth.users(id) on delete restrict,
  commission_percent  numeric(5,2) not null default 0,
  created_at          timestamptz  not null default now()
);

create index if not exists idx_order_items_order on public.order_items (order_id);
create index if not exists idx_order_items_artist on public.order_items (artist_account_id);
create index if not exists idx_order_items_gallery on public.order_items (gallery_account_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders_select_buyer" on public.orders;
create policy "orders_select_buyer" on public.orders
  for select using (auth.uid() = buyer_account_id);

drop policy if exists "order_items_select_party" on public.order_items;
create policy "order_items_select_party" on public.order_items
  for select using (
    auth.uid() = artist_account_id
    or auth.uid() = gallery_account_id
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.buyer_account_id = auth.uid()
    )
  );

revoke all on public.orders from anon;
revoke all on public.order_items from anon;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant all on public.orders to service_role;
grant all on public.order_items to service_role;

-- 5. seller_earnings: one Checkout session can now pay several works and
--    several people per work.
alter table public.seller_earnings
  drop constraint if exists seller_earnings_checkout_session_id_key;

alter table public.seller_earnings
  add column if not exists order_item_id uuid references public.order_items(id) on delete set null,
  add column if not exists role text not null default 'seller'
    check (role in ('seller', 'artist', 'gallery_commission'));

create unique index if not exists seller_earnings_session_artwork_seller_key
  on public.seller_earnings (checkout_session_id, artwork_id, seller_account_id);
create index if not exists idx_seller_earnings_session
  on public.seller_earnings (checkout_session_id);

-- 6. Hold every work in a cart at once, or none of them.
--    Returns the ids that could not be held (empty array = all held).
create or replace function public.reserve_artworks_for_checkout(
  p_artwork_ids uuid[],
  p_until timestamptz
) returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_busy uuid[];
begin
  -- Lock the rows in a stable order so two carts can't deadlock.
  perform 1 from public.artworks
    where id = any(p_artwork_ids)
    order by id
    for update;

  select coalesce(array_agg(id), '{}') into v_busy
  from public.artworks
  where id = any(p_artwork_ids)
    and (sold_at is not null
         or coalesce(is_sold, false)
         or (checkout_reserved_until is not null and checkout_reserved_until > now()));

  if array_length(v_busy, 1) > 0 then
    return v_busy;
  end if;

  update public.artworks
    set checkout_reserved_until = p_until
    where id = any(p_artwork_ids);

  return '{}';
end;
$$;

revoke all on function public.reserve_artworks_for_checkout(uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_artworks_for_checkout(uuid[], timestamptz) to service_role;
