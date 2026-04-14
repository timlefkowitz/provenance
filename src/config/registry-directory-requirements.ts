/**
 * Public directory (/registry, /artists) — only list rows with at least this many
 * **verified** artworks (same basis as registry artwork counts).
 *
 * Set to `1` to hide accounts/galleries with no verified work yet; increase (e.g. `3`)
 * for a stricter portfolio bar.
 */
export const MIN_VERIFIED_ARTWORKS_FOR_DIRECTORY = 1;
