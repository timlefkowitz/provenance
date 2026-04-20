/*
 * -------------------------------------------------------
 * Backfill artworks.certificate_type from owner account role
 *
 * Legacy rows (created before role-aware logic) can be stored as
 * certificate_type='authenticity' while the owner is a gallery/collector
 * and the record is still pending_artist_claim. That state blocks the
 * "Send to Artist" flow because sendArtistClaimInvite only accepts Show or
 * Ownership. This migration corrects those rows based on the account role.
 *
 * Conservative: only updates rows where certificate_status = 'pending_artist_claim'
 * (i.e. unclaimed uploads). Verified authenticity certificates are untouched.
 * -------------------------------------------------------
 */

update public.artworks as a
set certificate_type = 'show',
    updated_at = now()
from public.accounts as acc
where a.account_id = acc.id
  and a.certificate_status = 'pending_artist_claim'
  and coalesce(a.certificate_type, 'authenticity') <> 'show'
  and coalesce(a.certificate_type, 'authenticity') <> 'ownership'
  and (acc.public_data ->> 'role') in ('gallery', 'institution');

update public.artworks as a
set certificate_type = 'ownership',
    updated_at = now()
from public.accounts as acc
where a.account_id = acc.id
  and a.certificate_status = 'pending_artist_claim'
  and coalesce(a.certificate_type, 'authenticity') <> 'show'
  and coalesce(a.certificate_type, 'authenticity') <> 'ownership'
  and (acc.public_data ->> 'role') = 'collector';
