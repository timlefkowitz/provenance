/*
 * -------------------------------------------------------
 * Profile Sites — add missing DELETE RLS policy
 * -------------------------------------------------------
 *
 * The original migration (20260513000000_profile_sites.sql) added
 * SELECT, INSERT, and UPDATE policies but omitted DELETE.
 * With RLS enabled, Postgres silently filters every delete to 0 rows
 * and returns success — so the "Remove" and "Transfer" buttons in the
 * creator-website editor appeared to work but left the row intact,
 * causing the handle conflict to persist on every subsequent save.
 *
 * SAFETY: Purely additive. Mirrors the INSERT/UPDATE pattern exactly.
 * Only users who own the user_profiles row can delete the associated
 * profile_sites row.
 */

drop policy if exists profile_sites_delete_own on public.profile_sites;
create policy profile_sites_delete_own on public.profile_sites
  for delete using (
    profile_id in (
      select id from public.user_profiles where user_id = auth.uid()
    )
  );
