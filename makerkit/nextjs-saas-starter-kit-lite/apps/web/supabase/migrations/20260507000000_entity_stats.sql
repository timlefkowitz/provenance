-- migration: 20260507000000_entity_stats
-- Aggregated rollup stats for galleries, artists, institutions, and collectors.
-- Additive only.

create table if not exists public.entity_stats (
  entity_account_id uuid not null references public.accounts(id) on delete cascade,
  entity_role text not null
    check (entity_role in ('gallery','artist','institution','collector')),

  total_sales_count integer not null default 0,
  total_sales_cents bigint not null default 0,
  average_sale_cents bigint not null default 0,
  last_sale_at timestamptz,

  exhibition_count integer not null default 0,
  museum_exhibition_count integer not null default 0,

  represented_artwork_count integer not null default 0,
  artworks_produced_count integer not null default 0,

  market_cap_cents bigint not null default 0,
  auction_high_cents bigint not null default 0,
  auction_low_cents bigint not null default 0,
  auction_median_cents bigint not null default 0,

  scholarly_citations_count integer not null default 0,
  forgery_risk_flag boolean not null default false,
  rarity_index numeric(5,2) not null default 0,

  updated_at timestamptz not null default now(),
  stale_at timestamptz,

  primary key (entity_account_id, entity_role)
);

comment on table public.entity_stats is
  'Rolling aggregate stats per account per role. Refreshed synchronously on sales and exhibition changes; can be rebuilt via refreshAllEntityStats.';

create index if not exists entity_stats_role_last_sale_idx
  on public.entity_stats (entity_role, last_sale_at desc nulls last);

create index if not exists entity_stats_role_total_sales_idx
  on public.entity_stats (entity_role, total_sales_cents desc);

alter table public.entity_stats enable row level security;

-- Entity stats are readable by anyone signed in: they are descriptive facts
-- about galleries / artists / institutions that appear on profile pages.
drop policy if exists entity_stats_select_authenticated on public.entity_stats;
create policy entity_stats_select_authenticated on public.entity_stats
  for select
  to authenticated
  using (true);

grant select on table public.entity_stats to authenticated;
