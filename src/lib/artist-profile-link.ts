/**
 * Public href for the artist shown on a certificate or card — never the certificate poster's account_id.
 */
export function getArtistPublicProfileHref(artwork: {
  artist_account_id?: string | null;
  artist_profile_id?: string | null;
}): string | null {
  if (artwork.artist_account_id) {
    return `/artists/${artwork.artist_account_id}`;
  }
  if (artwork.artist_profile_id) {
    return `/artists/${artwork.artist_profile_id}`;
  }
  return null;
}
