/*
 * -------------------------------------------------------
 * Email preferences
 * Per-user opt-outs for optional emails (currently the weekly grants /
 * open-calls digest). Written by the one-click unsubscribe page using the
 * service role; users can also read/update their own row.
 *
 * DATA-SAFE: additive only. New table; no existing table or row is touched.
 * -------------------------------------------------------
 */

create table if not exists public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  digest_opt_out boolean not null default false,
  digest_opted_out_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);

comment on table public.email_preferences is 'Per-user email opt-outs (weekly digest). Absence of a row = subscribed.';
comment on column public.email_preferences.digest_opt_out is 'True = do not send the weekly grants/open-calls digest';

alter table public.email_preferences enable row level security;

drop policy if exists email_preferences_select_own on public.email_preferences;
drop policy if exists email_preferences_insert_own on public.email_preferences;
drop policy if exists email_preferences_update_own on public.email_preferences;

create policy email_preferences_select_own on public.email_preferences
  for select to authenticated using (user_id = (select auth.uid()));

create policy email_preferences_insert_own on public.email_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy email_preferences_update_own on public.email_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on table public.email_preferences to authenticated;
