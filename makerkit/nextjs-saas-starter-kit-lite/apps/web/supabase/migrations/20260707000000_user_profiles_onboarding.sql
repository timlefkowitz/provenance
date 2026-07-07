-- Add onboarding fields to user_profiles
-- has_sold_work: self-reported sales history from Taco onboarding interview
-- onboarding_answers: full raw answers jsonb (medium, goal, etc.)
-- onboarding_completed_at: when the Taco onboarding chat was completed

alter table public.user_profiles
  add column if not exists has_sold_work text
    check (has_sold_work in ('never', 'occasionally', 'regularly', 'gallery_represented')),
  add column if not exists onboarding_answers jsonb,
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.user_profiles.has_sold_work is
  'Self-reported sales history from Taco onboarding. Values: never, occasionally, regularly, gallery_represented';

comment on column public.user_profiles.onboarding_answers is
  'Full structured answers from the Taco onboarding interview (medium, goal, has_cv, etc.)';

comment on column public.user_profiles.onboarding_completed_at is
  'Timestamp when the artist completed the Taco onboarding interview';
