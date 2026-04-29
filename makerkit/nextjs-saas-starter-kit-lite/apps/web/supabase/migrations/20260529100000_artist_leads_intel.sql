/*
 * CRM: structured “deal brief” for a lead — pain points, next steps, insights, stakeholders.
 * Stored as JSON for flexible iteration without wide nullable columns.
 */

alter table public.artist_leads
  add column if not exists intel jsonb not null default '{}'::jsonb;

comment on column public.artist_leads.intel is
  'Structured meeting notes: account, systems, pain_points, next_steps, key_insights, positives, negatives, stakeholders[{name,role,email}]';

create index if not exists artist_leads_intel_gin_idx on public.artist_leads using gin (intel);
