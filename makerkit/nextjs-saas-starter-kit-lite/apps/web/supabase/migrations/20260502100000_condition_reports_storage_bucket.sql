/*
 * Private storage for condition report PDFs and documents; paths are user-scoped: {uid}/...
 *
 * DATA SAFETY (no loss or change to user/app data from public schema):
 * - No ALTER / DELETE / TRUNCATE / UPDATE on public.* or auth.* tables.
 * - No changes to public.condition_reports or to existing storage.objects rows.
 * - Inserts or replaces only: one row in storage.buckets (id: condition-reports) if missing;
 *   on re-run, ON CONFLICT DO NOTHING leaves an existing bucket unchanged.
 * - DROP POLICY / CREATE POLICY: only for policy names condition_reports_storage_*
 *   and only for rows where bucket_id = 'condition-reports' (other buckets’ policies
 *   and object rows are not affected).
 */

insert into storage.buckets (id, name, public)
values ('condition-reports', 'condition-reports', false)
on conflict (id) do nothing;

drop policy if exists condition_reports_storage_select on storage.objects;
drop policy if exists condition_reports_storage_insert on storage.objects;
drop policy if exists condition_reports_storage_update on storage.objects;
drop policy if exists condition_reports_storage_delete on storage.objects;

create policy condition_reports_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'condition-reports' and split_part(name, '/', 1) = (select auth.uid()::text));

create policy condition_reports_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'condition-reports' and split_part(name, '/', 1) = (select auth.uid()::text));

create policy condition_reports_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'condition-reports' and split_part(name, '/', 1) = (select auth.uid()::text))
  with check (bucket_id = 'condition-reports' and split_part(name, '/', 1) = (select auth.uid()::text));

create policy condition_reports_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'condition-reports' and split_part(name, '/', 1) = (select auth.uid()::text));
