/*
 * -------------------------------------------------------
 * Profile questionnaires
 * Artists, galleries and institutions can answer a short Q&A
 * ("What drew you to this medium?", "What is your programming focus?")
 * that shows on their public profile and, as an optional section,
 * on their website.
 *
 * Shape: [{ "question": text, "answer": text }], ordered as displayed.
 * Data-safe: adds a column with a default; existing rows get [].
 * -------------------------------------------------------
 */

alter table public.user_profiles
  add column if not exists questionnaire jsonb not null default '[]'::jsonb;

comment on column public.user_profiles.questionnaire is
  'Public Q&A answered by the profile owner: [{question, answer}] in display order';
