/*
 * Log admin outreach sends (invite emails, etc.) so we never double-email prospects.
 * Access: service role from admin server actions after isAdmin() check.
 */

create table if not exists public.admin_outreach_sends (
    id uuid primary key default gen_random_uuid(),
    email text not null check (length(trim(email)) >= 3),
    template_key text not null default 'invite',
    status text not null check (status in ('sent', 'failed', 'skipped')),
    skip_reason text,
    quality text,
    error_message text,
    sent_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

comment on table public.admin_outreach_sends is
    'Admin outreach send log. Used to dedupe invite emails and audit delivery.';

create index if not exists admin_outreach_sends_email_template_idx
    on public.admin_outreach_sends (lower(email), template_key);

create index if not exists admin_outreach_sends_created_at_idx
    on public.admin_outreach_sends (created_at desc);

create index if not exists admin_outreach_sends_sent_lookup_idx
    on public.admin_outreach_sends (lower(email))
    where status = 'sent';

alter table public.admin_outreach_sends enable row level security;

grant all on table public.admin_outreach_sends to service_role;
