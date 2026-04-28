-- =====================================================================
-- Feedback tickets + user presence / activity time
-- Run via Supabase SQL editor or `supabase migration new` workflow.
-- =====================================================================

-- ---------------------------------------------------------------------
-- feedback_tickets
-- ---------------------------------------------------------------------
create table if not exists public.feedback_tickets (
    id uuid primary key default gen_random_uuid(),
    submitted_by uuid references auth.users(id) on delete set null,
    is_anonymous boolean not null default false,
    -- Snapshot of identifying info captured at submission (used when
    -- submitted_by is null OR when we want to keep a stable record even
    -- if the user is later deleted).
    submitter_email text,
    submitter_name text,
    -- Content
    category varchar(32) not null default 'other'
        check (category in ('bug', 'idea', 'praise', 'question', 'other')),
    subject text,
    message text not null check (length(message) between 1 and 8000),
    page_url text,
    user_agent text,
    -- Workflow
    status varchar(20) not null default 'open'
        check (status in ('open', 'reviewing', 'resolved', 'archived')),
    admin_notes text,
    resolved_by uuid references auth.users(id) on delete set null,
    resolved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.feedback_tickets is
    'User-submitted feedback. Anonymous tickets store a null submitted_by. Admins triage via /admin/feedback.';

create index if not exists feedback_tickets_status_idx on public.feedback_tickets(status);
create index if not exists feedback_tickets_created_at_idx on public.feedback_tickets(created_at desc);
create index if not exists feedback_tickets_category_idx on public.feedback_tickets(category);
create index if not exists feedback_tickets_submitted_by_idx on public.feedback_tickets(submitted_by);

alter table public.feedback_tickets enable row level security;

drop policy if exists feedback_tickets_insert_authenticated on public.feedback_tickets;
drop policy if exists feedback_tickets_read_own on public.feedback_tickets;

-- Authenticated users can submit feedback. They MUST set submitted_by
-- to themselves OR mark the ticket anonymous (in which case
-- submitted_by must be null). The service-role client used by admins
-- bypasses RLS, so admins can read/update everything.
create policy feedback_tickets_insert_authenticated on public.feedback_tickets
    for insert
    to authenticated
    with check (
        (is_anonymous = false and submitted_by = (select auth.uid()))
        or (is_anonymous = true and submitted_by is null)
    );

-- A signed-in user can see their own (non-anonymous) tickets.
create policy feedback_tickets_read_own on public.feedback_tickets
    for select
    to authenticated
    using (
        is_anonymous = false and submitted_by = (select auth.uid())
    );

grant select, insert on table public.feedback_tickets to authenticated;
grant all on table public.feedback_tickets to service_role;

create or replace function public.update_feedback_tickets_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_feedback_tickets_updated_at_trigger on public.feedback_tickets;
create trigger update_feedback_tickets_updated_at_trigger
    before update on public.feedback_tickets
    for each row
    execute function public.update_feedback_tickets_updated_at();


-- ---------------------------------------------------------------------
-- user_presence
-- Lightweight aggregate updated by a 60-second client heartbeat.
-- Increments total_active_minutes by 1 each tick if at least 50 seconds
-- have passed since the last increment (dedupe + tab-switch tolerance).
-- ---------------------------------------------------------------------
create table if not exists public.user_presence (
    user_id uuid primary key references auth.users(id) on delete cascade,
    last_seen_at timestamptz not null default now(),
    last_incremented_at timestamptz,
    total_active_minutes integer not null default 0 check (total_active_minutes >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.user_presence is
    'Heartbeat-derived presence. last_seen_at is updated every ping; total_active_minutes increments at most once per minute.';

create index if not exists user_presence_last_seen_idx on public.user_presence(last_seen_at desc);
create index if not exists user_presence_total_minutes_idx on public.user_presence(total_active_minutes desc);

alter table public.user_presence enable row level security;

drop policy if exists user_presence_read_own on public.user_presence;
drop policy if exists user_presence_upsert_own on public.user_presence;
drop policy if exists user_presence_update_own on public.user_presence;

-- Users can read their own presence row (for "you've been here X hours" UI).
create policy user_presence_read_own on public.user_presence
    for select
    to authenticated
    using (user_id = (select auth.uid()));

-- Insert / upsert their own row.
create policy user_presence_upsert_own on public.user_presence
    for insert
    to authenticated
    with check (user_id = (select auth.uid()));

create policy user_presence_update_own on public.user_presence
    for update
    to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

grant select, insert, update on table public.user_presence to authenticated;
grant all on table public.user_presence to service_role;

create or replace function public.update_user_presence_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_user_presence_updated_at_trigger on public.user_presence;
create trigger update_user_presence_updated_at_trigger
    before update on public.user_presence
    for each row
    execute function public.update_user_presence_updated_at();


-- ---------------------------------------------------------------------
-- record_user_heartbeat(p_user_id uuid)
-- Idempotent helper called by /api/heartbeat. Always touches
-- last_seen_at, but only bumps total_active_minutes when at least
-- 50 seconds have elapsed since the previous increment.
-- ---------------------------------------------------------------------
create or replace function public.record_user_heartbeat(p_user_id uuid)
returns table (
    last_seen_at timestamptz,
    total_active_minutes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_now timestamptz := now();
    v_last_inc timestamptz;
    v_should_increment boolean;
    v_total integer;
    v_seen timestamptz;
begin
    insert into public.user_presence (user_id, last_seen_at, last_incremented_at, total_active_minutes)
    values (p_user_id, v_now, v_now, 1)
    on conflict (user_id) do update
        set last_seen_at = v_now,
            -- Bump only when the previous bump was >= 50s ago (or never).
            last_incremented_at = case
                when public.user_presence.last_incremented_at is null
                  or v_now - public.user_presence.last_incremented_at >= interval '50 seconds'
                then v_now
                else public.user_presence.last_incremented_at
            end,
            total_active_minutes = case
                when public.user_presence.last_incremented_at is null
                  or v_now - public.user_presence.last_incremented_at >= interval '50 seconds'
                then public.user_presence.total_active_minutes + 1
                else public.user_presence.total_active_minutes
            end
        returning user_presence.last_seen_at, user_presence.total_active_minutes
        into v_seen, v_total;

    return query select v_seen, v_total;
end;
$$;

revoke all on function public.record_user_heartbeat(uuid) from public;
grant execute on function public.record_user_heartbeat(uuid) to authenticated;
