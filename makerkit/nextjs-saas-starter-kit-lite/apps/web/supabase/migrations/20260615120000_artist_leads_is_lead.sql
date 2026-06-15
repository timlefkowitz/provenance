/*
 * -------------------------------------------------------
 * CRM: distinguish pipeline leads from mailing-list contacts
 * DATA-SAFE: additive only — no DELETE, TRUNCATE, or DROP TABLE.
 * - add column if not exists with default true (existing rows stay on kanban)
 * - create index if not exists (non-unique, dedup remains app-level)
 * - RLS policies unchanged (is_crm_member still governs access)
 * -------------------------------------------------------
 */

-- Existing CRM rows default to pipeline leads so behavior is unchanged.
alter table public.artist_leads
  add column if not exists is_lead boolean not null default true;

-- Belt-and-suspenders: ensure every pre-existing row stays on the pipeline.
-- (ADD COLUMN ... DEFAULT true already backfills; this is idempotent if re-run.)
update public.artist_leads
set is_lead = true
where is_lead is distinct from true;

comment on column public.artist_leads.is_lead is
  'When false, contact appears in mailing list / contacts only — not on the sales kanban.';

-- Partial index for email dedup lookups; not unique (duplicates allowed in legacy data).
create index if not exists artist_leads_email_idx
  on public.artist_leads (artist_user_id, lower(contact_email))
  where contact_email is not null;
