/** Key in `exhibitions.metadata` naming the artwork chosen as the header. */
export const HEADER_ARTWORK_METADATA_KEY = 'header_artwork_id';

export function readHeaderArtworkId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>)[HEADER_ARTWORK_METADATA_KEY];
  return typeof value === 'string' && value ? value : null;
}

/**
 * The image to show at the top of an exhibition. When the header is an artwork
 * still in the show, use that artwork's current image (it may have been
 * replaced since); otherwise the saved `image_url`.
 */
export function resolveExhibitionHeaderImage(exhibition: {
  image_url: string | null;
  metadata?: unknown;
  artworks?: Array<{ id: string; image_url: string | null }>;
}): string | null {
  const artworkId = readHeaderArtworkId(exhibition.metadata);
  if (artworkId) {
    const current = exhibition.artworks?.find((a) => a.id === artworkId)?.image_url?.trim();
    if (current) return current;
  }
  return exhibition.image_url?.trim() || null;
}
