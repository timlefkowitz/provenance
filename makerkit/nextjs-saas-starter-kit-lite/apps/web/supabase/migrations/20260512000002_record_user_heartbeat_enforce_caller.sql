/*
 * Harden record_user_heartbeat: SECURITY DEFINER must not let one user
 * update another user's presence. Require p_user_id = auth.uid().
 */

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
