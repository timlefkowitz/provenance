/*
 * -------------------------------------------------------
 * Exhibition invite links
 *
 * Galleries can copy an invite link to send themselves (text, Instagram DM)
 * instead of, or as well as, emailing it.
 *
 * - invitee_email becomes optional: a link-only invite has no email until an
 *   artist opens the link and signs in. That artist claims the invite (their
 *   email and account are written onto it); after that it works only for them.
 * - token_nonce: the invite token is now an HMAC of the invite id and this
 *   nonce with a server secret, so the gallery can copy the same link again
 *   later. Only the token's hash is stored, as before. Invites made before
 *   this have no nonce; copying their link issues a new one (the emailed link
 *   then stops working).
 *
 * Additive only (see MIGRATIONS.md).
 * -------------------------------------------------------
 */

alter table public.exhibition_artist_invites
  alter column invitee_email drop not null;

alter table public.exhibition_artist_invites
  add column if not exists token_nonce text;

comment on column public.exhibition_artist_invites.invitee_email is
  'PII: invitee email address; null for a link-only invite until an artist claims it. Service role only';
comment on column public.exhibition_artist_invites.token_nonce is
  'Nonce for the HMAC-derived invite token (lets organisers re-copy the link); null for older random tokens';
