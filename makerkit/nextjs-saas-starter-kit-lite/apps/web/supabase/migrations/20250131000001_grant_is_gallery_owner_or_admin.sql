/*
 * Grant EXECUTE on is_gallery_owner_or_admin to authenticated.
 * Required so RLS policies can call the function (otherwise: permission denied).
 */

grant execute on function public.is_gallery_owner_or_admin(uuid) to authenticated;
