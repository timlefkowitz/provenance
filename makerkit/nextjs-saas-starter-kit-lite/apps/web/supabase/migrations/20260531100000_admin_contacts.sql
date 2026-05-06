/*
 * Admin outreach contact list (CRM-lite). Not end-user profile contact blocks.
 * UI: src/app/admin/contacts/
 * Access: service role from server actions after isAdmin() check only.
 */

create table if not exists public.admin_contacts (
    id uuid primary key default gen_random_uuid(),
    display_name text not null check (length(trim(display_name)) >= 1),
    email text,
    phone text,
    company text,
    website text,
    notes text,
    source text not null default 'manual',
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.admin_contacts is
    'Admin-only list for growth/outreach. Populated manually or from tooling; RLS has no user-facing policies.';

create index if not exists admin_contacts_created_at_idx
    on public.admin_contacts (created_at desc);
create index if not exists admin_contacts_email_idx
    on public.admin_contacts (email)
    where email is not null;

alter table public.admin_contacts enable row level security;

-- Regular JWT sessions cannot read or write this table; admin routes use the
-- service-role client after verifying accounts.public_data.admin server-side.
grant all on table public.admin_contacts to service_role;

create or replace function public.update_admin_contacts_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_admin_contacts_updated_at_trigger on public.admin_contacts;
create trigger update_admin_contacts_updated_at_trigger
    before update on public.admin_contacts
    for each row
    execute function public.update_admin_contacts_updated_at();
