/**
 * Public directory (/registry, /artists) — only list rows with at least this many
 * qualifying verified artworks:
 * - Artists / non-gallery accounts: verified Certificates of Authenticity only
 *   (COO-only collectors are excluded).
 * - Gallery profiles: verified Certificates of Show only.
 *
 * Set to `1` to hide accounts/galleries with no qualifying work; increase (e.g. `3`)
 * for a stricter portfolio bar.
 */
export const MIN_VERIFIED_ARTWORKS_FOR_DIRECTORY = 1;
