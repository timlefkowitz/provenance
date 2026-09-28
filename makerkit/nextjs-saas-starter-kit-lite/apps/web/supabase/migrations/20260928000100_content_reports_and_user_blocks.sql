/*
 * -------------------------------------------------------
 * User-generated content safety (App Store guideline 1.2)
 *
 * 1. content_reports — users report artworks, collectibles, profiles and
 *    exhibitions; admins triage them at /admin/reports.
 * 2. user_blocks — a user hides everything from another user. Blocked
 *    users' content is filtered out of the blocker's feed, registry and
 *    detail pages, and any follow between the two is removed.
 *
 * DATA-SAFE: additive only. New tables; no existing table or row is touched.
 * -------------------------------------------------------
 */

-- ─── 1. content_reports ────────────────────────────────────────────────────

create table if not exists public.content_reports (
  id              uuid primary key default extensions.uuid_generate_v4(),
  reporter_id     uuid not null references auth.users(id) on delete cascade,
  target_type     text not null check (target_type in ('artwork', 'collectible', 'profile', 'exhibition', 'user')),
  target_id       text not null,
  -- The user who owns the reported content, when known (for bans / blocking).
  target_owner_id uuid references auth.users(id) on delete set null,
  reason          text not null check (reason in ('spam', 'offensive', 'harassment', 'sexual', 'violence', 'ip_infringement', 'impersonation', 'other')),
  details         text check (char_length(details) <= 2000),
  page_url        text,
  status          text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolution      text,
  admin_notes     text,
  resolved_by     uuid references auth.users(id) on delete set null,
  resolved_at     timestamp with time zone,
  created_at      timestamp with time zone not null default now()
);

comment on table public.content_reports is 'User reports of objectionable content; triaged by admins at /admin/reports (guideline 1.2)';

create index if not exists content_reports_status_created_idx on public.content_reports(status, created_at desc);
create index if not exists content_reports_target_idx on public.content_reports(target_type, target_id);
create index if not exists content_reports_reporter_idx on public.content_reports(reporter_id);

alter table public.content_reports enable row level security;

drop policy if exists content_reports_insert_own on public.content_reports;
drop policy if exists content_reports_select_own on public.content_reports;

create policy content_reports_insert_own on public.content_reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- Reporters see only their own reports; admins use the service role.
create policy content_reports_select_own on public.content_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

grant select, insert on table public.content_reports to authenticated;

-- ─── 2. user_blocks ────────────────────────────────────────────────────────

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

comment on table public.user_blocks is 'User A (blocker) hides all content from user B (blocked) (guideline 1.2)';

create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select_own on public.user_blocks;
drop policy if exists user_blocks_insert_own on public.user_blocks;
drop policy if exists user_blocks_delete_own on public.user_blocks;

create policy user_blocks_select_own on public.user_blocks
  for select to authenticated using (blocker_id = (select auth.uid()));

create policy user_blocks_insert_own on public.user_blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));

create policy user_blocks_delete_own on public.user_blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

grant select, insert, delete on table public.user_blocks to authenticated;
