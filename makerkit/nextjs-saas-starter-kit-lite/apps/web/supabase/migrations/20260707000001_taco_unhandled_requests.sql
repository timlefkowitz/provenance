-- Taco unhandled requests
-- Records messages where Taco flagged that it could not fulfil the user's request,
-- so the product team can track feature gaps and wishlist items.

create table if not exists public.taco_unhandled_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  user_message   text not null,
  taco_summary   text not null,   -- Taco's own 1-2 sentence description of what was asked
  pathname       text,            -- the app route the user was on
  resolved       boolean not null default false,
  admin_note     text,            -- optional note from an admin
  created_at     timestamptz not null default now()
);

-- Admins can read everything; users cannot read this table
alter table public.taco_unhandled_requests enable row level security;

-- Matches the app-level admin check in src/lib/admin.ts (accounts.public_data->>'admin').
-- In practice, admin server actions read this table via the service-role client
-- (bypassing RLS after a requireAdmin() check), so this policy is defense-in-depth.
drop policy if exists "Admin full access to taco_unhandled_requests" on public.taco_unhandled_requests;
create policy "Admin full access to taco_unhandled_requests"
  on public.taco_unhandled_requests
  for all
  using (
    exists (
      select 1 from public.accounts a
      where a.id = auth.uid()
        and (a.public_data ->> 'admin') = 'true'
    )
  );

-- Index for the admin list query
create index if not exists taco_unhandled_requests_created_at_idx
  on public.taco_unhandled_requests (created_at desc);

create index if not exists taco_unhandled_requests_resolved_idx
  on public.taco_unhandled_requests (resolved, created_at desc);
