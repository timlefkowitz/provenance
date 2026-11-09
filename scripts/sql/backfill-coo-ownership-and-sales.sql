-- Backfill for certificates of ownership (CoO) that were accepted before the
-- 2026-11-07 fix. For each accepted owner invite it:
--   1. sets "Owned by" to the collector on every linked certificate (CoA/CoS/CoO),
--      moving the previous owner into former owners and removing the
--      collector's own "Name (date)" line that the old code put there;
--   2. links the collector to the sale on the source certificate, or records
--      the sale (ledger row + sold columns) when none existed;
--   2d. does the same for CoOs that were SENT but not yet accepted: sending a
--      CoO now records the sale to that email, so the collector is counted;
--   3. clears scan counts/places that a new certificate copied from its source.
-- Afterwards, run the nightly stats refresh once (GET /api/cron/refresh-entity-stats).
--
-- DRY RUN BY DEFAULT: the whole script runs in a transaction that ends in
-- ROLLBACK and prints the counts. Change the last line to COMMIT to apply.
-- Safe to re-run: every step skips rows that are already fixed.

begin;

-- ── Accepted owner invites ─────────────────────────────────────────────────
create temp table bf_claims on commit drop as
select
  i.id                                   as invite_id,
  i.source_artwork_id,
  i.result_artwork_id                    as coo_id,
  i.consumed_by                          as buyer_id,
  lower(trim(i.invitee_email))           as buyer_email,
  coalesce(i.consumed_at, i.updated_at)  as claimed_at,
  coalesce(nullif(trim(acc.name), ''), nullif(trim(src.sold_to_name), ''), 'Private collector') as buyer_name
from public.certificate_claim_invites i
join public.artworks src on src.id = i.source_artwork_id
left join public.accounts acc on acc.id = i.consumed_by
where i.status = 'consumed'
  and i.claim_kind like 'owner_%'
  and i.result_artwork_id is not null
  and i.consumed_by is not null;

-- Root of each CoO's certificate chain.
create temp table bf_chain on commit drop as
with recursive up as (
  select a.id as coo_id, a.id as cur, a.source_artwork_id as parent, 0 as depth
  from public.artworks a
  where a.id in (select coo_id from bf_claims)
  union all
  select up.coo_id, p.id, p.source_artwork_id, up.depth + 1
  from up join public.artworks p on p.id = up.parent
  where up.depth < 64
)
select coo_id, cur as root_id from up where parent is null;

-- Every certificate in each chain.
create temp table bf_members on commit drop as
with recursive down as (
  select distinct root_id, root_id as id, 0 as depth from bf_chain
  union
  select d.root_id, c.id, d.depth + 1
  from down d join public.artworks c on c.source_artwork_id = d.id
  where d.depth < 64
)
select distinct root_id, id from down;

-- The most recent accepted claim per chain decides the current owner.
create temp table bf_latest on commit drop as
select distinct on (ch.root_id)
  ch.root_id, c.invite_id, c.source_artwork_id, c.coo_id, c.buyer_id, c.buyer_email, c.claimed_at,
  -- keep a fuller name already on record ("Monica and Papillon Romero" ⊇ "Papillon Romero")
  case when position(lower(c.buyer_name) in lower(coalesce(src.owned_by, ''))) > 0
       then trim(src.owned_by) else c.buyer_name end as buyer_name,
  c.buyer_name as account_name,
  src.owned_by as previous_owner
from bf_claims c
join bf_chain ch on ch.coo_id = c.coo_id
join public.artworks src on src.id = c.source_artwork_id
order by ch.root_id, c.claimed_at desc nulls last;

-- ── 1. Owner on every linked certificate ───────────────────────────────────
create temp table bf_owner_updates on commit drop as
select
  a.id,
  l.coo_id,
  l.buyer_name,
  a.owned_by       as old_owned_by,
  a.former_owners  as old_former_owners,
  nullif(
    array_to_string(
      array(
        select line from (
          -- drop blank lines and the collector's own line(s)
          select trim(x) as line, ord
          from unnest(string_to_array(coalesce(a.former_owners, ''), E'\n')) with ordinality as t(x, ord)
          where trim(x) <> ''
            and lower(trim(x)) <> lower(l.buyer_name)
            and position(lower(l.buyer_name) || ' (' in lower(trim(x))) <> 1
            and lower(trim(x)) <> lower(l.account_name)
            and position(lower(l.account_name) || ' (' in lower(trim(x))) <> 1
          union all
          -- previous owner, dated, unless it is the collector or already listed
          select trim(l.previous_owner) || ' (until ' || to_char(l.claimed_at, 'YYYY-MM-DD') || ')', 1000000
          where nullif(trim(l.previous_owner), '') is not null
            and lower(trim(l.previous_owner)) <> lower(l.buyer_name)
            and not exists (
              select 1 from unnest(string_to_array(coalesce(a.former_owners, ''), E'\n')) y
              where lower(trim(y)) = lower(trim(l.previous_owner))
                 or position(lower(trim(l.previous_owner)) || ' (' in lower(trim(y))) = 1
            )
        ) lines
        order by ord
      ),
      E'\n'
    ),
    ''
  ) as new_former_owners
from bf_latest l
join bf_members m on m.root_id = l.root_id
join public.artworks a on a.id = m.id
where coalesce(a.owned_by, '') is distinct from l.buyer_name;

update public.artworks a
set
  owned_by = u.buyer_name,
  former_owners = u.new_former_owners,
  provenance_history = (
    coalesce(a.provenance_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'editedAt', now(),
      'editedBy', null,
      'previousValues', jsonb_build_object('owned_by', u.old_owned_by, 'former_owners', u.old_former_owners),
      'via', jsonb_build_object(
        'certificate_type', 'ownership',
        'artwork_id', u.coo_id,
        'method', 'backfill',
        'actor_name', null
      )
    ))
  )
from bf_owner_updates u
where a.id = u.id;

-- ── 2. Sales ───────────────────────────────────────────────────────────────
-- 2a. Existing ledger row on the source with no account: link the collector.
create temp table bf_ledger_links on commit drop as
select distinct on (c.invite_id) c.invite_id, s.id as sale_id, c.buyer_id, c.buyer_email, c.buyer_name
from bf_claims c
join public.sales_ledger s on s.artwork_id = c.source_artwork_id
where s.sold_to_account_id is null
  and (s.sold_to_email is null or lower(s.sold_to_email) = c.buyer_email)
order by c.invite_id, s.sold_at desc;

update public.sales_ledger s
set sold_to_account_id = l.buyer_id,
    sold_to_email = coalesce(s.sold_to_email, l.buyer_email),
    sold_to_name = coalesce(s.sold_to_name, l.buyer_name)
from bf_ledger_links l
where s.id = l.sale_id;

-- 2b. No ledger row for the source at all: record the sale.
create temp table bf_new_sales on commit drop as
select c.*, src.account_id as seller_id, src.sold_price_cents, coalesce(src.sold_currency, 'USD') as currency,
       coalesce(src.sold_at, c.claimed_at) as sold_at
from bf_claims c
join public.artworks src on src.id = c.source_artwork_id
where not exists (select 1 from public.sales_ledger s where s.artwork_id = c.source_artwork_id)
  and not exists (
    select 1 from public.sales_ledger s where s.metadata->>'invite_id' = c.invite_id::text
  );

insert into public.sales_ledger
  (artwork_id, sold_by_account_id, sold_to_account_id, sold_to_email, sold_to_name,
   price_cents, currency, sold_at, recorded_by, metadata)
select source_artwork_id, seller_id, buyer_id, buyer_email, buyer_name,
       sold_price_cents, currency, sold_at, null,
       jsonb_build_object('source', 'coo_accept_backfill', 'invite_id', invite_id)
from bf_new_sales;

-- 2c. Sold columns on the source certificate.
update public.artworks a
set is_sold = true,
    sold_at = coalesce(a.sold_at, c.claimed_at),
    sold_by_account_id = coalesce(a.sold_by_account_id, a.account_id),
    sold_to_account_id = coalesce(a.sold_to_account_id, c.buyer_id),
    sold_to_email = coalesce(a.sold_to_email, c.buyer_email),
    sold_to_name = coalesce(a.sold_to_name, c.buyer_name)
from bf_claims c
where a.id = c.source_artwork_id
  and (a.is_sold is not true or a.sold_at is null or a.sold_to_account_id is null);

-- 2d. CoOs sent but not accepted: record the sale to the invitee's email.
create temp table bf_sent_sales on commit drop as
select distinct on (i.source_artwork_id)
  i.id as invite_id, i.source_artwork_id, lower(trim(i.invitee_email)) as buyer_email,
  i.created_at, i.created_by, src.account_id as seller_id,
  src.sold_price_cents, coalesce(src.sold_currency, 'USD') as currency,
  coalesce(src.sold_at, i.created_at) as sold_at
from public.certificate_claim_invites i
join public.artworks src on src.id = i.source_artwork_id
left join public.accounts sender on sender.id = i.created_by
where i.status in ('sent', 'pending')
  and i.claim_kind like 'owner_%'
  -- a CoO sent to the sender's own email is not a sale
  and lower(trim(i.invitee_email)) is distinct from lower(trim(sender.email))
  and not exists (select 1 from public.sales_ledger s where s.artwork_id = i.source_artwork_id)
  and not exists (select 1 from bf_new_sales n where n.source_artwork_id = i.source_artwork_id)
order by i.source_artwork_id, i.created_at desc;

insert into public.sales_ledger
  (artwork_id, sold_by_account_id, sold_to_email, price_cents, currency, sold_at, recorded_by, metadata)
select source_artwork_id, seller_id, buyer_email, sold_price_cents, currency, sold_at, created_by,
       jsonb_build_object('source', 'coo_sent_backfill', 'invite_id', invite_id)
from bf_sent_sales;

update public.artworks a
set is_sold = true,
    sold_at = coalesce(a.sold_at, s.sold_at),
    sold_by_account_id = coalesce(a.sold_by_account_id, a.account_id),
    sold_to_email = coalesce(a.sold_to_email, s.buyer_email)
from bf_sent_sales s
where a.id = s.source_artwork_id;

-- ── 3. Scan data copied onto linked certificates ───────────────────────────
create temp table bf_scan_fixes on commit drop as
select child.id
from public.artworks child
join public.artworks parent on parent.id = child.source_artwork_id
where child.metadata ? 'scan_stats'
  and child.metadata->'scan_stats' = parent.metadata->'scan_stats';

update public.artworks a
set metadata = a.metadata - 'scan_stats' - 'scan_locations'
from bf_scan_fixes f
where a.id = f.id;

-- ── Summary ────────────────────────────────────────────────────────────────
select 'accepted owner invites'            as step, count(*) as rows from bf_claims
union all select 'certificates: owner set',        count(*) from bf_owner_updates
union all select 'ledger rows linked to collector', count(*) from bf_ledger_links
union all select 'sales recorded (accepted CoO)',   count(*) from bf_new_sales
union all select 'sales recorded (sent CoO)',       count(*) from bf_sent_sales
union all select 'certificates: copied scans cleared', count(*) from bf_scan_fixes;

-- Owner changes, for review
select u.id, u.old_owned_by, u.buyer_name as new_owned_by, u.old_former_owners, u.new_former_owners
from bf_owner_updates u
order by u.id
limit 200;

rollback;  -- change to COMMIT to apply
