/*
 * -------------------------------------------------------
 * Profile handoffs to existing accounts, and declining them
 *
 * A managed artist or managed collection can now be handed to someone who is
 * already on Provenance, picked by searching profiles. Those invites name the
 * recipient's account (recipient_user_id) and are accepted or declined in the
 * app; the email address becomes optional for them.
 *
 * Also lets a recipient decline a handoff ('declined' status, declined_at).
 * The works then stay with the person who built the profile.
 *
 * DATA SAFE: adds nullable columns, relaxes a NOT NULL, swaps a CHECK for a
 * wider one, adds an index. No DROP TABLE, TRUNCATE, DELETE, or UPDATE of rows.
 * -------------------------------------------------------
 */

alter table public.profile_handoff_invites
  add column if not exists recipient_user_id uuid references auth.users (id) on delete cascade,
  add column if not exists declined_at timestamptz;

alter table public.profile_handoff_invites
  alter column invitee_email drop not null;

alter table public.profile_handoff_invites
  drop constraint if exists profile_handoff_invites_status_check;

alter table public.profile_handoff_invites
  add constraint profile_handoff_invites_status_check
  check (status in ('sent', 'consumed', 'cancelled', 'expired', 'declined'));

alter table public.profile_handoff_invites
  drop constraint if exists profile_handoff_invites_target_check;

alter table public.profile_handoff_invites
  add constraint profile_handoff_invites_target_check
  check (invitee_email is not null or recipient_user_id is not null);

create index if not exists profile_handoff_invites_recipient_idx
  on public.profile_handoff_invites (recipient_user_id, status)
  where recipient_user_id is not null;

create index if not exists profile_handoff_invites_email_idx
  on public.profile_handoff_invites (lower(invitee_email), status)
  where invitee_email is not null;
