/*
 * Migration: Apple In-App Purchase support for subscriptions table
 *
 * Adds columns needed to store Apple IAP subscriptions sourced via RevenueCat,
 * alongside existing Stripe subscription rows.
 *
 * Existing Stripe rows are unaffected: provider defaults to 'stripe' and all
 * Stripe-specific columns remain unchanged. Apple IAP rows will have NULL
 * stripe_subscription_id / stripe_price_id / stripe_customer_id, and the new
 * apple_original_transaction_id column becomes their unique identifier for
 * upsert conflict resolution.
 *
 * stripe_subscription_id stays nullable (was already, since unique(null) is
 * allowed in PostgreSQL and existing Stripe rows always have a value).
 */

-- 1. Payment provider that originated this subscription row.
alter table public.subscriptions
  add column if not exists provider text not null default 'stripe'
    check (provider in ('stripe', 'apple_iap'));

-- 2. RevenueCat subscriber ID — we use the Supabase user_id as the RC
--    app_user_id, but store it explicitly for debugging / REST API lookups.
alter table public.subscriptions
  add column if not exists revenuecat_subscriber_id text;

-- 3. Apple's original transaction ID — the stable lifetime identifier for an
--    Apple subscription (survives plan changes, renewals, and device changes).
--    Used as the upsert conflict key for Apple IAP rows.
alter table public.subscriptions
  add column if not exists apple_original_transaction_id text;

-- Unique constraint for Apple IAP upserts (mirrors stripe_subscription_id's
-- unique constraint used for Stripe upserts). Allows multiple NULLs
-- (Stripe rows) because PostgreSQL unique constraints ignore NULLs.
create unique index if not exists subscriptions_apple_transaction_id_unique
  on public.subscriptions (apple_original_transaction_id)
  where apple_original_transaction_id is not null;

-- Index for RevenueCat subscriber lookups (one per user, but index helps
-- direct webhook lookup by subscriber id without needing to join).
create index if not exists subscriptions_revenuecat_subscriber_id_idx
  on public.subscriptions (revenuecat_subscriber_id)
  where revenuecat_subscriber_id is not null;

-- Index for fast provider-filtered queries.
create index if not exists subscriptions_provider_idx
  on public.subscriptions (provider);

comment on column public.subscriptions.provider is
  'Payment provider: stripe (default) or apple_iap (RevenueCat)';
comment on column public.subscriptions.revenuecat_subscriber_id is
  'RevenueCat subscriber ID — equals the Supabase user_id we pass as appUserID';
comment on column public.subscriptions.apple_original_transaction_id is
  'Apple original transaction ID — stable lifetime key for Apple IAP subscriptions';
