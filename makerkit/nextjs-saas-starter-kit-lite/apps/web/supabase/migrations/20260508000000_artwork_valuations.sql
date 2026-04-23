-- migration: 20260508000000_artwork_valuations
-- Append-only valuation history per artwork. The "current" valuation is the
-- most recent row. Inputs and outputs are stored together so we can evolve
-- the algorithm (engine_version) without losing history.
-- Additive only.

create table if not exists public.artwork_valuations (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.accounts(id) on delete set null,
  engine_version text not null default 'v1',
  llm_model text,

  -- snapshot inputs
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

  -- outputs
  estimated_value_cents bigint,
  confidence_low_cents bigint,
  confidence_high_cents bigint,
  cultural_importance_score numeric(5,2),
  liquidity_score numeric(5,2),
  forgery_risk_score numeric(5,2),
  narrative text,
  is_public boolean not null default false
);

comment on table public.artwork_valuations is
  'Append-only provenance valuations. Latest row per artwork is the current valuation.';

create index if not exists artwork_valuations_artwork_generated_idx
  on public.artwork_valuations (artwork_id, generated_at desc);

create index if not exists artwork_valuations_public_idx
  on public.artwork_valuations (artwork_id, is_public, generated_at desc)
  where is_public;

alter table public.artwork_valuations enable row level security;

-- Artwork owners can always read their valuations. Anyone signed in can read
-- valuations marked public.
drop policy if exists artwork_valuations_select_owner on public.artwork_valuations;
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

grant select on table public.artwork_valuations to authenticated;

-- INSERT / UPDATE via server actions using the admin client.
