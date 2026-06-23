/*
 * Domain purchases — tracks in-app domain buys via GoDaddy + Stripe one-time payment.
 */

create table if not exists public.domain_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  domain text not null,
  stripe_checkout_session_id text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'purchased', 'failed')),
  error text,
  price_usd_cents integer,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

comment on table public.domain_purchases is
  'In-app domain purchases: Stripe checkout → GoDaddy register → attach to profile_sites.';

create index if not exists domain_purchases_user_id_idx on public.domain_purchases(user_id);
create index if not exists domain_purchases_profile_id_idx on public.domain_purchases(profile_id);
create index if not exists domain_purchases_status_idx on public.domain_purchases(status);

-- Prevent duplicate successful purchases of the same domain for a profile
create unique index if not exists domain_purchases_profile_domain_purchased_idx
  on public.domain_purchases(profile_id, domain)
  where status = 'purchased';

create or replace function public.domain_purchases_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists domain_purchases_updated_at on public.domain_purchases;
create trigger domain_purchases_updated_at
  before update on public.domain_purchases
  for each row execute function public.domain_purchases_set_updated_at();

alter table public.domain_purchases enable row level security;

drop policy if exists domain_purchases_select_own on public.domain_purchases;
create policy domain_purchases_select_own on public.domain_purchases
  for select using (auth.uid() = user_id);
