/*
 * -------------------------------------------------------
 * Sign in with Apple refresh tokens (App Store guideline 5.1.1(v))
 *
 * Apple requires apps that offer Sign in with Apple to revoke the user's
 * token (POST https://appleid.apple.com/auth/revoke) when they delete their
 * account. Supabase doesn't persist Apple's refresh token, so the auth
 * callback stores it here the moment it's issued; deleteAccount() revokes it.
 *
 * No RLS policies: only the service role (server) can read or write. Users
 * never need to see this token.
 *
 * DATA-SAFE: additive only. New table; no existing table or row is touched.
 * -------------------------------------------------------
 */

create table if not exists public.apple_signin_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamp with time zone not null default now()
);

comment on table public.apple_signin_tokens is 'Apple refresh token per Sign in with Apple user, used only to revoke on account deletion (5.1.1(v)). Service role only.';

alter table public.apple_signin_tokens enable row level security;

revoke all on table public.apple_signin_tokens from anon, authenticated;
