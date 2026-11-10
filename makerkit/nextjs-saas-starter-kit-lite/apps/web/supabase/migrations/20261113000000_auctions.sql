/*
 * -------------------------------------------------------
 * Auctions
 * Timed online auctions. An auction is run by an organizer account (a
 * gallery / institution running an exhibition as an auction, or a collector
 * auctioning works they own). Each work is a lot with a start price, an
 * optional hidden reserve and its own closing time (lots close one after
 * another, and a late bid extends that lot). Collectors can consign works
 * into auctions that accept consignments; the organizer approves them.
 *
 * Payment is settled off-platform: when a lot closes above its reserve the
 * app records a normal sale (sales_ledger, red dot, Certificate of Ownership
 * invite to the winner).
 *
 * All writes go through server actions with the service role, except bids,
 * which go through place_auction_bid() so concurrent bids are serialized.
 * -------------------------------------------------------
 */

create table if not exists public.auctions (
    id uuid primary key default gen_random_uuid(),
    organizer_account_id uuid not null references auth.users(id) on delete cascade,
    organizer_profile_id uuid references public.user_profiles(id) on delete set null,
    owner_role text check (owner_role in ('artist', 'collector', 'gallery', 'institution')),
    exhibition_id uuid unique references public.exhibitions(id) on delete set null,
    title text not null check (char_length(btrim(title)) between 1 and 200),
    description text,
    image_url text,
    currency text not null default 'USD',
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    lot_stagger_seconds integer not null default 60 check (lot_stagger_seconds between 0 and 3600),
    anti_snipe_seconds integer not null default 120 check (anti_snipe_seconds between 0 and 3600),
    accepts_consignments boolean not null default false,
    status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'cancelled')),
    published_at timestamptz,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (ends_at > starts_at)
);

create index if not exists auctions_organizer_idx on public.auctions (organizer_account_id);
create index if not exists auctions_status_ends_idx on public.auctions (status, ends_at);

create table if not exists public.auction_lots (
    id uuid primary key default gen_random_uuid(),
    auction_id uuid not null references public.auctions(id) on delete cascade,
    artwork_id uuid not null references public.artworks(id) on delete cascade,
    lot_number integer not null default 1,
    -- Who put the work in: the organizer for their own / exhibition lots,
    -- or the collector who consigned it. They are the seller of record.
    consignor_account_id uuid not null references auth.users(id) on delete cascade,
    status text not null default 'open'
        check (status in ('pending', 'declined', 'withdrawn', 'open', 'sold', 'passed')),
    start_price_cents bigint not null default 0 check (start_price_cents >= 0),
    increment_cents bigint check (increment_cents is null or increment_cents > 0),
    ends_at timestamptz,
    current_bid_cents bigint,
    current_bidder_account_id uuid references auth.users(id) on delete set null,
    bid_count integer not null default 0,
    closed_at timestamptz,
    sale_recorded_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists auction_lots_auction_idx on public.auction_lots (auction_id, lot_number);
create index if not exists auction_lots_open_ends_idx on public.auction_lots (ends_at) where status = 'open';
create index if not exists auction_lots_bidder_idx on public.auction_lots (current_bidder_account_id);
-- A work can only be on offer in one auction at a time.
create unique index if not exists auction_lots_artwork_active_idx
    on public.auction_lots (artwork_id) where status in ('pending', 'open');

-- Kept apart from auction_lots so the reserve never reaches bidders.
create table if not exists public.auction_lot_reserves (
    lot_id uuid primary key references public.auction_lots(id) on delete cascade,
    reserve_cents bigint not null check (reserve_cents >= 0)
);

create table if not exists public.auction_bids (
    id uuid primary key default gen_random_uuid(),
    lot_id uuid not null references public.auction_lots(id) on delete cascade,
    bidder_account_id uuid not null references auth.users(id) on delete cascade,
    amount_cents bigint not null check (amount_cents > 0),
    created_at timestamptz not null default now()
);

create index if not exists auction_bids_lot_idx on public.auction_bids (lot_id, amount_cents desc);
create index if not exists auction_bids_bidder_idx on public.auction_bids (bidder_account_id, created_at desc);

alter table public.auctions enable row level security;
alter table public.auction_lots enable row level security;
alter table public.auction_lot_reserves enable row level security;
alter table public.auction_bids enable row level security;

-- Read-only for clients; every write is a server action (service role) or place_auction_bid().
grant select on public.auctions to anon, authenticated;
grant select on public.auction_lots to anon, authenticated;
grant select on public.auction_lot_reserves to authenticated;
grant select on public.auction_bids to authenticated;

-- anon has no EXECUTE on is_gallery_member_for_exhibition, so it gets its own policies.
drop policy if exists auctions_read_public on public.auctions;
create policy auctions_read_public on public.auctions
    for select
    to anon
    using (published_at is not null and status <> 'draft');

drop policy if exists auctions_read on public.auctions;
create policy auctions_read on public.auctions
    for select
    to authenticated
    using (
        (published_at is not null and status <> 'draft')
        or organizer_account_id = (select auth.uid())
        or public.is_gallery_member_for_exhibition(organizer_account_id)
    );

drop policy if exists auction_lots_read_public on public.auction_lots;
create policy auction_lots_read_public on public.auction_lots
    for select
    to anon
    using (
        auction_lots.status in ('open', 'sold', 'passed')
        and exists (
            select 1 from public.auctions a
            where a.id = auction_lots.auction_id
              and a.published_at is not null and a.status <> 'draft'
        )
    );

drop policy if exists auction_lots_read on public.auction_lots;
create policy auction_lots_read on public.auction_lots
    for select
    to authenticated
    using (
        consignor_account_id = (select auth.uid())
        or exists (
            select 1 from public.auctions a
            where a.id = auction_lots.auction_id
              and (
                  (a.published_at is not null and a.status <> 'draft'
                     and auction_lots.status in ('open', 'sold', 'passed'))
                  or a.organizer_account_id = (select auth.uid())
                  or public.is_gallery_member_for_exhibition(a.organizer_account_id)
              )
        )
    );

drop policy if exists auction_lot_reserves_read on public.auction_lot_reserves;
create policy auction_lot_reserves_read on public.auction_lot_reserves
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.auction_lots l
            join public.auctions a on a.id = l.auction_id
            where l.id = auction_lot_reserves.lot_id
              and (
                  l.consignor_account_id = (select auth.uid())
                  or a.organizer_account_id = (select auth.uid())
                  or public.is_gallery_member_for_exhibition(a.organizer_account_id)
              )
        )
    );

drop policy if exists auction_bids_read on public.auction_bids;
create policy auction_bids_read on public.auction_bids
    for select
    to authenticated
    using (
        bidder_account_id = (select auth.uid())
        or exists (
            select 1
            from public.auction_lots l
            join public.auctions a on a.id = l.auction_id
            where l.id = auction_bids.lot_id
              and (
                  a.organizer_account_id = (select auth.uid())
                  or public.is_gallery_member_for_exhibition(a.organizer_account_id)
              )
        )
    );

/*
 * Default bid increment ladder. Must match incrementFor() in
 * src/lib/auctions/bid-rules.ts (a unit test pins the shared cases).
 */
create or replace function public.auction_bid_increment(p_current_cents bigint)
returns bigint
language sql
immutable
as $$
    select case
        when p_current_cents < 50000 then 2500
        when p_current_cents < 100000 then 5000
        when p_current_cents < 500000 then 10000
        when p_current_cents < 1000000 then 25000
        when p_current_cents < 5000000 then 50000
        else 100000
    end::bigint
$$;

/*
 * Place a bid as the signed-in user. Locks the lot row so concurrent bids
 * are applied one at a time. Returns jsonb:
 *   { ok: true, lot_id, current_bid_cents, bid_count, ends_at, next_min_cents,
 *     previous_bidder_account_id, extended }
 *   { ok: false, error: '<code>', next_min_cents? }
 */
create or replace function public.place_auction_bid(p_lot_id uuid, p_amount_cents bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_lot public.auction_lots%rowtype;
    v_auction public.auctions%rowtype;
    v_min bigint;
    v_prev uuid;
    v_new_ends timestamptz;
    v_extended boolean := false;
    v_next bigint;
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'error', 'not_authenticated');
    end if;

    select * into v_lot from public.auction_lots where id = p_lot_id for update;
    if not found then
        return jsonb_build_object('ok', false, 'error', 'lot_not_found');
    end if;

    select * into v_auction from public.auctions where id = v_lot.auction_id;
    if v_auction.status <> 'published' or v_auction.published_at is null then
        return jsonb_build_object('ok', false, 'error', 'auction_not_open');
    end if;
    if now() < v_auction.starts_at then
        return jsonb_build_object('ok', false, 'error', 'auction_not_started');
    end if;
    if v_lot.status <> 'open' or v_lot.ends_at is null or now() >= v_lot.ends_at then
        return jsonb_build_object('ok', false, 'error', 'lot_closed');
    end if;
    if v_uid = v_lot.consignor_account_id
       or v_uid = v_auction.organizer_account_id
       or public.is_gallery_member_for_exhibition(v_auction.organizer_account_id) then
        return jsonb_build_object('ok', false, 'error', 'own_lot');
    end if;
    if v_uid = v_lot.current_bidder_account_id then
        return jsonb_build_object('ok', false, 'error', 'already_leading');
    end if;

    if v_lot.current_bid_cents is null then
        v_min := greatest(v_lot.start_price_cents, 100);
    else
        v_min := v_lot.current_bid_cents
            + coalesce(v_lot.increment_cents, public.auction_bid_increment(v_lot.current_bid_cents));
    end if;

    if p_amount_cents is null or p_amount_cents < v_min then
        return jsonb_build_object('ok', false, 'error', 'bid_too_low', 'next_min_cents', v_min);
    end if;
    if p_amount_cents > 100000000000 then
        return jsonb_build_object('ok', false, 'error', 'bid_too_high');
    end if;

    v_prev := v_lot.current_bidder_account_id;

    insert into public.auction_bids (lot_id, bidder_account_id, amount_cents)
    values (p_lot_id, v_uid, p_amount_cents);

    v_new_ends := v_lot.ends_at;
    if v_auction.anti_snipe_seconds > 0
       and v_lot.ends_at - now() < make_interval(secs => v_auction.anti_snipe_seconds) then
        v_new_ends := now() + make_interval(secs => v_auction.anti_snipe_seconds);
        v_extended := true;
    end if;

    update public.auction_lots
       set current_bid_cents = p_amount_cents,
           current_bidder_account_id = v_uid,
           bid_count = bid_count + 1,
           ends_at = v_new_ends,
           updated_at = now()
     where id = p_lot_id;

    v_next := p_amount_cents + coalesce(v_lot.increment_cents, public.auction_bid_increment(p_amount_cents));

    return jsonb_build_object(
        'ok', true,
        'lot_id', p_lot_id,
        'current_bid_cents', p_amount_cents,
        'bid_count', v_lot.bid_count + 1,
        'ends_at', v_new_ends,
        'next_min_cents', v_next,
        'previous_bidder_account_id', v_prev,
        'extended', v_extended
    );
end;
$$;

revoke all on function public.place_auction_bid(uuid, bigint) from public, anon;
grant execute on function public.place_auction_bid(uuid, bigint) to authenticated;
grant execute on function public.auction_bid_increment(bigint) to anon, authenticated;

comment on table public.auctions is 'Timed online auctions run by an organizer account; optionally an exhibition run as an auction.';
comment on table public.auction_lots is 'Works offered in an auction, each with its own closing time and current high bid.';
comment on table public.auction_lot_reserves is 'Hidden reserve per lot; readable only by the organizer team and the consignor.';
comment on table public.auction_bids is 'Every bid placed; bidders see their own, organizers see all.';
