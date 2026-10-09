/*
 * -------------------------------------------------------
 * Record which Apple client issued each Sign in with Apple refresh token.
 *
 * Web sign-ins go through the Services ID; native iOS sign-ins
 * (ASAuthorizationController) are issued to the app's bundle ID. Apple's
 * /auth/revoke must be called with the same client_id that issued the token,
 * so deleteAccount() reads it from here. Null = the Services ID
 * (APPLE_SIGNIN_CLIENT_ID), which covers every row stored before this column.
 *
 * DATA-SAFE: additive only. Adds a nullable column; no rows are changed.
 * -------------------------------------------------------
 */

alter table public.apple_signin_tokens add column if not exists client_id text;

comment on column public.apple_signin_tokens.client_id is 'Apple client_id that issued refresh_token (bundle ID for native iOS sign-in); null = APPLE_SIGNIN_CLIENT_ID Services ID.';
