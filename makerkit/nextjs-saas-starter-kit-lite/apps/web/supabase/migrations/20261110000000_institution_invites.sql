/*
 * -------------------------------------------------------
 * Institution invites
 *
 * A Provenance admin invites a museum's (or other institution's) team by
 * email. Each person gets their own invite link. Accepting it:
 *   - adds them to the institution profile's team (gallery_members),
 *   - grants a complimentary institution trial (default 90 days),
 *   - locks a fresh account to institution mode.
 *
 * All reads and writes go through server actions with the service role, so
 * the table has RLS on and no policies.
 *
 * DATA SAFE: creates one new table and its indexes. No DROP, TRUNCATE,
 * DELETE, or UPDATE of existing rows.
 * -------------------------------------------------------
 */

create table if not exists public.institution_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  institution_profile_id uuid not null references public.user_profiles (id) on delete cascade,
  email text not null,
  team_role text not null default 'member' check (team_role in ('admin', 'member')),
  trial_days integer not null default 90 check (trial_days > 0 and trial_days <= 365),
  note text,
  invited_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz,
  send_count integer not null default 0,
  last_send_error text,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists institution_invites_profile_idx
  on public.institution_invites (institution_profile_id, created_at desc);

create index if not exists institution_invites_email_idx
  on public.institution_invites (lower(email));

-- One open (not accepted, not revoked) invite per person per institution.
create unique index if not exists institution_invites_open_unique
  on public.institution_invites (institution_profile_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.institution_invites enable row level security;

revoke all on public.institution_invites from anon, authenticated;
grant all on public.institution_invites to service_role;
