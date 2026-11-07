/*
 * -------------------------------------------------------
 * Reservation requests + opt-in public phone numbers
 *
 * 1. user_profiles.show_phone: the profile owner chooses whether the phone
 *    number on their profile is shown publicly (off by default, so nobody's
 *    existing number appears without them opting in).
 *
 * 2. artwork_reservation_requests: a visitor asks to reserve a piece in an
 *    exhibition. The exhibition owner (and their team) sees the request and
 *    accepts or declines it. Writes go through server actions using the
 *    service role after their own checks (anonymous visitors can ask too), so
 *    there are no insert/update policies; signed-in requesters and the owner
 *    can read their own rows.
 *
 * Data-safe: adds a defaulted column and a new table; no rows are touched.
 * -------------------------------------------------------
 */

alter table public.user_profiles
  add column if not exists show_phone boolean not null default false;

comment on column public.user_profiles.show_phone is
  'When true the profile''s phone number is shown publicly (opt-in)';

create table if not exists public.artwork_reservation_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  exhibition_id uuid references public.exhibitions(id) on delete set null,
  -- Account that receives the request (the exhibition owner).
  recipient_account_id uuid not null references public.accounts(id) on delete cascade,
  requester_user_id uuid references auth.users(id) on delete set null,
  requester_name text not null check (char_length(requester_name) between 1 and 120),
  requester_email text check (requester_email is null or char_length(requester_email) <= 254),
  requester_phone text check (requester_phone is null or char_length(requester_phone) <= 40),
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  responded_at timestamptz,
  responded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint artwork_reservation_requests_contact
    check (requester_email is not null or requester_phone is not null)
);

comment on table public.artwork_reservation_requests is
  'Visitor requests to reserve an artwork shown in an exhibition';

create index if not exists artwork_reservation_requests_exhibition_idx
  on public.artwork_reservation_requests (exhibition_id, created_at desc);
create index if not exists artwork_reservation_requests_recipient_idx
  on public.artwork_reservation_requests (recipient_account_id, status);
create index if not exists artwork_reservation_requests_artwork_idx
  on public.artwork_reservation_requests (artwork_id);

alter table public.artwork_reservation_requests enable row level security;

revoke all on table public.artwork_reservation_requests from anon;
grant select on table public.artwork_reservation_requests to authenticated;

drop policy if exists artwork_reservation_requests_read on public.artwork_reservation_requests;
create policy artwork_reservation_requests_read on public.artwork_reservation_requests
  for select
  to authenticated
  using (
    requester_user_id = (select auth.uid())
    or recipient_account_id = (select auth.uid())
  );
