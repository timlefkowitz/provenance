/*
 * -------------------------------------------------------
 * Exhibition artist collaboration: solo, group and open-call shows
 *
 * 1. exhibitions.show_type: 'solo' (one invited artist co-writes the show),
 *    'group' (selected artists invited) or 'open_call' (any artist submits,
 *    the organiser reviews). Null is a show made before this existed; it
 *    behaves as it always has (invited work waits for review).
 *
 * 2. exhibitions.field_sources: who filled each show field, e.g.
 *    {"title":"gallery","description":"artist"}. An invited artist who may
 *    edit the show can change any field not marked 'gallery'; for those they
 *    send a change request instead.
 *
 * 3. exhibition_artist_invites gains:
 *    - accepted_at / accepted_by and the 'accepted' status: the artist opened
 *      the invite signed in with the invited email. Accepted invites stay
 *      usable (they are no longer used up by the first submission).
 *    - planned_piece_count / artist_notes: what the artist tells the gallery
 *      about their part of the show.
 *    - can_edit_show: the artist may fill in the show's own details (solo).
 *
 * 4. exhibition_change_requests: an invited artist asks the organiser to
 *    change a field the organiser filled. The organiser approves (the value
 *    is applied) or declines with a reply.
 *
 * Writes go through server actions with the service role after the action
 * checks access, so there are no insert/update policies.
 *
 * Additive only (see MIGRATIONS.md).
 * -------------------------------------------------------
 */

-- 1 + 2. Exhibitions --------------------------------------------------------
alter table public.exhibitions
  add column if not exists show_type text;

alter table public.exhibitions
  drop constraint if exists exhibitions_show_type_check;

alter table public.exhibitions
  add constraint exhibitions_show_type_check
  check (show_type is null or show_type in ('solo', 'group', 'open_call'));

alter table public.exhibitions
  add column if not exists field_sources jsonb not null default '{}'::jsonb;

comment on column public.exhibitions.show_type is
  'solo | group | open_call; null = created before show types (invited work is reviewed)';
comment on column public.exhibitions.field_sources is
  'Who filled each show field: {"title":"gallery"|"artist", ...}; gallery fields are locked for invited artists';

-- 3. Invites ----------------------------------------------------------------
alter table public.exhibition_artist_invites
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists planned_piece_count integer
    check (planned_piece_count is null or (planned_piece_count >= 0 and planned_piece_count <= 1000)),
  add column if not exists artist_notes text
    check (artist_notes is null or char_length(artist_notes) <= 4000),
  add column if not exists can_edit_show boolean not null default false;

alter table public.exhibition_artist_invites
  drop constraint if exists exhibition_artist_invites_status_check;

alter table public.exhibition_artist_invites
  add constraint exhibition_artist_invites_status_check
  check (status in ('pending', 'sent', 'accepted', 'consumed', 'cancelled', 'expired'));

-- One open invite per email per show now includes accepted invites.
drop index if exists public.exhibition_artist_invites_open_email_idx;
create unique index if not exists exhibition_artist_invites_open_email_idx
  on public.exhibition_artist_invites (exhibition_id, lower(invitee_email))
  where status in ('pending', 'sent', 'accepted');

create index if not exists exhibition_artist_invites_accepted_by_idx
  on public.exhibition_artist_invites (accepted_by)
  where accepted_by is not null;

comment on column public.exhibition_artist_invites.can_edit_show is
  'Artist may fill in the show details (solo shows); gallery-filled fields still need a change request';

-- 4. Change requests --------------------------------------------------------
create table if not exists public.exhibition_change_requests (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  invite_id uuid not null references public.exhibition_artist_invites(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  field text not null
    check (field in ('title', 'description', 'start_date', 'end_date', 'location', 'image_url')),
  current_value jsonb,
  proposed_value jsonb,
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'withdrawn')),
  response_message text check (response_message is null or char_length(response_message) <= 2000),
  responded_by uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exhibition_change_requests_exhibition_idx
  on public.exhibition_change_requests (exhibition_id, status, created_at desc);
create index if not exists exhibition_change_requests_requester_idx
  on public.exhibition_change_requests (requested_by, created_at desc);
create unique index if not exists exhibition_change_requests_one_open
  on public.exhibition_change_requests (invite_id, field)
  where status = 'pending';

alter table public.exhibition_change_requests enable row level security;

drop policy if exists exhibition_change_requests_read_requester on public.exhibition_change_requests;
create policy exhibition_change_requests_read_requester on public.exhibition_change_requests
  for select
  to authenticated
  using (requested_by = auth.uid());

drop policy if exists exhibition_change_requests_read_organiser on public.exhibition_change_requests;
create policy exhibition_change_requests_read_organiser on public.exhibition_change_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.exhibitions e
      where e.id = exhibition_change_requests.exhibition_id
        and (e.gallery_id = auth.uid() or public.is_gallery_member_for_exhibition(e.gallery_id))
    )
  );

create or replace function public.update_exhibition_change_requests_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_exhibition_change_requests_updated_at_trigger
  on public.exhibition_change_requests;

create trigger update_exhibition_change_requests_updated_at_trigger
  before update on public.exhibition_change_requests
  for each row
  execute function public.update_exhibition_change_requests_updated_at();
