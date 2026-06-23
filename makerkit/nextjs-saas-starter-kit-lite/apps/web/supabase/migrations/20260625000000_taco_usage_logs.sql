-- Taco AI usage logging
-- Records every /api/taco/chat request with token counts, cost estimate,
-- agent iterations, and attachment metadata for admin cost monitoring.

create table if not exists public.taco_usage_logs (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  created_at          timestamptz not null default now(),

  -- OpenAI token usage accumulated across all agent iterations for this request
  prompt_tokens       integer     not null default 0,
  completion_tokens   integer     not null default 0,
  total_tokens        integer     not null default 0,

  -- How many agentic loop iterations ran before a final reply was produced
  agent_iterations    integer     not null default 1,

  -- Whether the request included uploaded images or documents
  had_images          boolean     not null default false,
  had_docs            boolean     not null default false,

  -- Derived cost estimate using gpt-4o rates ($2.50/1M input, $10.00/1M output).
  -- Authoritative billing is always in the OpenAI dashboard; this is for reference.
  estimated_cost_usd  numeric(10, 8) not null default 0
);

-- Index for per-user lookups and admin leaderboard queries
create index if not exists taco_usage_logs_user_id_idx
  on public.taco_usage_logs (user_id);

-- Index for time-ordered queries (recent rows, month-to-date aggregates)
create index if not exists taco_usage_logs_created_at_idx
  on public.taco_usage_logs (created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Inserts arrive via the service-role admin client (API route), which bypasses
-- RLS. Authenticated users have no read policy here — usage data is admin-only.
-- If this migration is re-run, the drop guards keep it idempotent.
alter table public.taco_usage_logs enable row level security;

drop policy if exists taco_usage_logs_select_own on public.taco_usage_logs;

-- ── Grants ───────────────────────────────────────────────────────────────────
-- The service_role needs explicit DML permission even though it bypasses RLS.
-- Authenticated users receive no grant — they cannot touch this table directly.
grant all on table public.taco_usage_logs to service_role;
