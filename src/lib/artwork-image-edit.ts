/**
 * Non-destructive artwork photo edits.
 *
 * `image_url` is the photo shown everywhere. When it was cropped / rotated from
 * another photo, `original_image_url` keeps that untouched upload: every new
 * edit starts from it, and it can be restored. Null means `image_url` is
 * itself the original.
 */

export type ArtworkImageColumns = {
  image_url: string | null;
  original_image_url: string | null;
};

export type ArtworkImageChange =
  /** A different photo: it becomes its own original. */
  | { kind: 'replace'; imageUrl: string }
  /**
   * An edited version of the artwork's photo. `uploadedOriginalUrl` is set when
   * the edit was made from a photo picked in the same save (that upload is the
   * original); otherwise the current original is kept.
   */
  | { kind: 'edit'; imageUrl: string; uploadedOriginalUrl?: string | null }
  /** Put the original back and drop the edit. */
  | { kind: 'restore' };

/** The image columns after a change, or null when nothing changes. */
export function nextArtworkImageColumns(
  current: ArtworkImageColumns,
  change: ArtworkImageChange,
): ArtworkImageColumns | null {
  switch (change.kind) {
    case 'replace':
      return { image_url: change.imageUrl, original_image_url: null };
    case 'edit':
      return {
        image_url: change.imageUrl,
        original_image_url:
          change.uploadedOriginalUrl ||
          current.original_image_url ||
          current.image_url,
      };
    case 'restore':
      if (!current.original_image_url) return null;
      return { image_url: current.original_image_url, original_image_url: null };
  }
}

/**
 * Scale for a straightened photo so the rotated image still fills the frame
 * with no blank corners, keeping the photo's aspect ratio.
 */
export function straightenFillScale(width: number, height: number, degrees: number): number {
  const rad = (Math.abs(degrees) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  if (width <= 0 || height <= 0) return 1;
  return Math.min(width / (width * c + height * s), height / (width * s + height * c));
}
