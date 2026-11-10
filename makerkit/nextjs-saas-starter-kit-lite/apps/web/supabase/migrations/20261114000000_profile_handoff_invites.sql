/*
 * -------------------------------------------------------
 * Profile handoff invites
 *
 * Someone can build a profile for a person who isn't on Provenance yet and
 * hand it over later:
 *   - a managed collection (collector profile, user_id = the builder,
 *     is_claimed = false), whose works are Certificates of Ownership;
 *   - a managed artist (artist profile, user_id = null, is_claimed = false,
 *     created_by_gallery_id = the builder, managed_for_name set), whose works
 *     are Certificates of Authenticity an artist manager issued, waiting for
 *     the artist to accept them.
 *
 * The builder sends a handoff invite to the person's email. Accepting it moves
 * the profile (or, if they already have one, its works) to their account.
 *
 * All reads and writes go through server actions with the service role, so
 * the table has RLS on and no policies.
 *
 * DATA SAFE: creates one new table and its indexes. No DROP, TRUNCATE,
 * DELETE, or UPDATE of existing rows.
 * -------------------------------------------------------
 */

create table if not exists public.profile_handoff_invites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.user_profiles (id) on delete cascade,
  invitee_email text not null,
  token_hash text not null unique,
  status text not null default 'sent'
    check (status in ('sent', 'consumed', 'cancelled', 'expired')),
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  consumed_by uuid references auth.users (id) on delete set null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.profile_handoff_invites is
  'Invites that hand a managed collection or managed artist profile over to its real owner';

create index if not exists profile_handoff_invites_profile_idx
  on public.profile_handoff_invites (profile_id, created_at desc);

alter table public.profile_handoff_invites enable row level security;
