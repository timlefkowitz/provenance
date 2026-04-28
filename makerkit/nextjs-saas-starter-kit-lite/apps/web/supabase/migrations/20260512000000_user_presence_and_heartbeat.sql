/*
 * Heartbeat-derived presence for dashboard analytics (/admin user activity).
 * Client: PresenceTracker -> POST /api/heartbeat -> record_user_heartbeat.
 */

-- ---------------------------------------------------------------------
-- user_presence
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

create policy user_presence_read_own on public.user_presence
    for select
    to authenticated
    using (user_id = (select auth.uid()));

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
    v_total integer;
    v_seen timestamptz;
begin
    if (select auth.uid()) is distinct from p_user_id then
        raise exception 'not authorized'
            using errcode = '42501';
    end if;

    insert into public.user_presence (user_id, last_seen_at, last_incremented_at, total_active_minutes)
    values (p_user_id, v_now, v_now, 1)
    on conflict (user_id) do update
        set last_seen_at = v_now,
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
