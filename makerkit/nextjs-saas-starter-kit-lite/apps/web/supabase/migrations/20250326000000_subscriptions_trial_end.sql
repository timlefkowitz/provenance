-- When status is trialing, trial_end is the user-facing trial end (Stripe trial_end or app-provisioned trial).
-- current_period_end may reflect billing period boundaries and must not be used alone for "trial ends on" copy.
alter table public.subscriptions
  add column if not exists trial_end timestamp with time zone;

comment on column public.subscriptions.trial_end is 'End of trial period; synced from Stripe subscription.trial_end or set for app trial rows';

-- App-provisioned trials (stripe_subscription_id trial_*): mirror period end into trial_end for existing rows
update public.subscriptions
set trial_end = current_period_end
where trial_end is null
  and status = 'trialing'
  and stripe_subscription_id like 'trial_%';
