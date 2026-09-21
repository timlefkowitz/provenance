-- READ-ONLY diagnostic: which CRM / operations schema pieces exist in production, and what the
-- CHECK constraints and stored values currently are. Contains only SELECTs; changes nothing.
-- Run in the Supabase SQL editor and share all three result sets.

-- 1) What exists
select 'table crm_members' as item, to_regclass('public.crm_members') is not null as present
union all select 'table crm_settings',    to_regclass('public.crm_settings') is not null
union all select 'table consignments',    to_regclass('public.consignments') is not null
union all select 'table condition_reports', to_regclass('public.condition_reports') is not null
union all select 'function is_crm_member', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'is_crm_member')
union all select 'column artwork_loan_agreements.alert_sent_at', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'artwork_loan_agreements' and column_name = 'alert_sent_at')
union all select 'column artwork_loan_agreements.renewal_count', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'artwork_loan_agreements' and column_name = 'renewal_count')
union all select 'column artwork_loan_agreements.borrower_user_id', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'artwork_loan_agreements' and column_name = 'borrower_user_id')
union all select 'storage bucket condition-reports', exists (select 1 from storage.buckets where id = 'condition-reports')
order by 1;

-- 2) Current CHECK constraints on the two tables migration 0430 rewrites.
--    provenance_events should list the WIDEST set of event types (from migrations 0503-0505).
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'c'
  and conrelid in ('public.provenance_events'::regclass, 'public.artwork_loan_agreements'::regclass)
order by 1, 2;

-- 3) Values actually stored in those columns (any value outside a constraint's list would block it)
select 'provenance_events.event_type' as column_name, event_type::text as value, count(*) as rows
from public.provenance_events group by event_type
union all
select 'artwork_loan_agreements.status', status::text, count(*)
from public.artwork_loan_agreements group by status
order by 1, 2;
