/*
 * APPLY_VALUATION_MIGRATIONS.sql
 *
 * Run this ONLY in the Supabase SQL Editor for provenance valuation support.
 * DATA-SAFE: creates two new empty tables only. Does not modify artworks,
 * accounts, or any existing user rows.
 *
 * Do NOT run the full SYNC_VIA_DASHBOARD.sql on production — that file replays
 * the entire migration history and will trigger destructive-operation warnings.
 *
 * If these tables already exist, this script is a no-op (IF NOT EXISTS / policy checks).
 */

-- ========== entity_stats ==========

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

alter table public.entity_stats enable row level security;

create index if not exists entity_stats_role_last_sale_idx
  on public.entity_stats (entity_role, last_sale_at desc nulls last);

create index if not exists entity_stats_role_total_sales_idx
  on public.entity_stats (entity_role, total_sales_cents desc);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'entity_stats'
      and policyname = 'entity_stats_select_authenticated'
  ) then
    create policy entity_stats_select_authenticated on public.entity_stats
      for select
      to authenticated
      using (true);
  end if;
end $$;

grant select on table public.entity_stats to authenticated;

-- ========== artwork_valuations ==========

create table if not exists public.artwork_valuations (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.accounts(id) on delete set null,
  engine_version text not null default 'v1',
  llm_model text,

  medium text,
  condition text,
  rarity_index numeric(5,2),
  former_owners_count integer default 0,
  notable_collectors_count integer default 0,
  museum_count integer default 0,
  artist_market_cap_cents bigint default 0,
  auction_history_summary jsonb not null default '{}'::jsonb,
  museum_presence_count integer default 0,
  exhibition_count integer default 0,
  scholarly_citations_count integer default 0,
  market_signals jsonb not null default '{}'::jsonb,

  estimated_value_cents bigint,
  confidence_low_cents bigint,
  confidence_high_cents bigint,
  cultural_importance_score numeric(5,2),
  liquidity_score numeric(5,2),
  forgery_risk_score numeric(5,2),
  narrative text,
  is_public boolean not null default false
);

alter table public.artwork_valuations enable row level security;

create index if not exists artwork_valuations_artwork_generated_idx
  on public.artwork_valuations (artwork_id, generated_at desc);

create index if not exists artwork_valuations_public_idx
  on public.artwork_valuations (artwork_id, is_public, generated_at desc)
  where is_public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'artwork_valuations'
      and policyname = 'artwork_valuations_select_owner'
  ) then
    create policy artwork_valuations_select_owner on public.artwork_valuations
      for select
      to authenticated
      using (
        is_public
        or exists (
          select 1 from public.artworks a
          where a.id = artwork_valuations.artwork_id
            and a.account_id = (select auth.uid())
        )
      );
  end if;
end $$;

grant select on table public.artwork_valuations to authenticated;
