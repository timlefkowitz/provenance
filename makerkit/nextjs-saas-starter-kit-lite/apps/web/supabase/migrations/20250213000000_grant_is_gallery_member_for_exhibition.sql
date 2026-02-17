/*
 * Grant EXECUTE on is_gallery_member_for_exhibition to authenticated.
 * Required so RLS policies on exhibitions can call the function (otherwise: permission denied for function is_gallery_member_for_exhibition).
 */

grant execute on function public.is_gallery_member_for_exhibition(uuid) to authenticated;
