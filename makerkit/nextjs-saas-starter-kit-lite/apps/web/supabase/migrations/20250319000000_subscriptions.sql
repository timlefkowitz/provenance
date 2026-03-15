/*
 * -------------------------------------------------------
 * Stripe customer id per user (set when first creating Checkout)
 * -------------------------------------------------------
 */
create table if not exists public.stripe_customers (
    user_id uuid primary key references auth.users(id) on delete cascade,
    stripe_customer_id text not null unique,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

comment on table public.stripe_customers is 'Maps auth user to Stripe customer for checkout';

alter table public.stripe_customers enable row level security;

drop policy if exists stripe_customers_select_own on public.stripe_customers;
create policy stripe_customers_select_own on public.stripe_customers
    for select using (auth.uid() = user_id);

/*
 * -------------------------------------------------------
 * Stripe subscription state (synced via webhook)
 * One row per user subscription; webhook upserts by stripe_subscription_id.
 * -------------------------------------------------------
 */

create table if not exists public.subscriptions (
    id uuid primary key default extensions.uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_price_id text,
    status text not null check (status in ('active', 'canceled', 'past_due', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired', 'paused')),
    current_period_end timestamp with time zone,
    role varchar(20) not null check (role in ('artist', 'collector', 'gallery')),
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    unique(stripe_subscription_id)
);

comment on table public.subscriptions is 'Stripe subscription state per user; updated by Stripe webhook';
comment on column public.subscriptions.role is 'Plan role: artist | collector | gallery';
comment on column public.subscriptions.status is 'Stripe subscription status';

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_stripe_subscription_id_idx on public.subscriptions(stripe_subscription_id);
create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions(stripe_customer_id);

alter table public.subscriptions enable row level security;

-- Users can read their own subscription(s) only
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
    for select
    using (auth.uid() = user_id);

-- Insert/update/delete are done server-side with service role (webhook); no policy for authenticated users
