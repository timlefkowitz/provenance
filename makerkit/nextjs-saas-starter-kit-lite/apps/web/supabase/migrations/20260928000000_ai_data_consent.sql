/*
 * -------------------------------------------------------
 * AI data-sharing consent
 * Records whether a user has given explicit permission for their personal
 * data to be sent to our third-party AI provider (OpenAI) to power AI
 * features (assistants, CV/checklist extraction, valuations, press search,
 * AI grant picks in the weekly digest). App Store guideline 5.1.2(i).
 *
 * Absence of a row = no consent. Revoking keeps the row with consented=false
 * so the history of the decision is retained.
 *
 * DATA-SAFE: additive only. New table; no existing table or row is touched.
 * -------------------------------------------------------
 */

create table if not exists public.ai_data_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consented boolean not null default false,
  consented_at timestamp with time zone,
  revoked_at timestamp with time zone,
  policy_version text not null,
  updated_at timestamp with time zone not null default now()
);

comment on table public.ai_data_consents is 'Per-user consent to share personal data with third-party AI (OpenAI). Absence of a row = not consented.';
comment on column public.ai_data_consents.policy_version is 'Version of the AI disclosure the user agreed to (see src/lib/ai-consent.ts)';

alter table public.ai_data_consents enable row level security;

drop policy if exists ai_data_consents_select_own on public.ai_data_consents;
drop policy if exists ai_data_consents_insert_own on public.ai_data_consents;
drop policy if exists ai_data_consents_update_own on public.ai_data_consents;

create policy ai_data_consents_select_own on public.ai_data_consents
  for select to authenticated using (user_id = (select auth.uid()));

create policy ai_data_consents_insert_own on public.ai_data_consents
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy ai_data_consents_update_own on public.ai_data_consents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on table public.ai_data_consents to authenticated;
