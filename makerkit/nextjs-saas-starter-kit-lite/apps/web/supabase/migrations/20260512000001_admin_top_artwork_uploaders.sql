/*
 * Admin-only helper: top users by artworks.created_by (who posted the record).
 * Called from server with service_role; not granted to anon/authenticated.
 */

create or replace function public.admin_top_artwork_uploaders(p_limit integer default 8)
returns table (user_id uuid, upload_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select created_by as user_id, count(*)::bigint as upload_count
  from public.artworks
  where created_by is not null
  group by created_by
  order by upload_count desc
  limit least(coalesce(p_limit, 8), 50);
$$;

revoke all on function public.admin_top_artwork_uploaders(integer) from public;
grant execute on function public.admin_top_artwork_uploaders(integer) to service_role;
