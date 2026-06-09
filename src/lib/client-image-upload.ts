/**
 * Client-side helpers for preparing photos before sending them to a Server Action.
 *
 * Why this exists, especially for iPhone:
 * - iPhone photos are typically 3–10 MB and Vercel rejects Server Action request
 *   bodies over ~4.5 MB before the action ever runs, so large photos must be
 *   compressed in the browser first.
 * - iOS photo-library picks are often HEIC with `file.type` of `image/heic` or
 *   even an empty string, so naive `file.type.startsWith('image/')` checks and
 *   JPEG/PNG-only server validation wrongly reject valid photos. iOS Safari can
 *   decode HEIC natively, so we re-encode to JPEG on the client.
 */

/** Keep payloads safely under Vercel's ~4.5MB server action body limit. */
export const MAX_UPLOAD_IMAGE_BYTES = 4 * 1024 * 1024;

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$/i;

/** Formats every browser and our storage buckets accept without conversion. */
const WEB_SAFE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * True when the file is plausibly an image. Accepts empty `file.type` (common for
 * iPhone HEIC picks) when the extension looks like an image, or when there is no
 * extension at all (iOS camera capture can produce nameless files).
 */
export function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  if (file.type !== '') return false;
  const name = file.name || '';
  return !name.includes('.') || IMAGE_EXTENSIONS.test(name);
}

/**
 * Prepare an image for upload to a Server Action:
 * - Re-encodes HEIC/unknown formats to JPEG (iOS Safari decodes HEIC natively).
 * - Downscales/compresses images over maxBytes.
 * Returns the original file when it is already web-safe and small enough, or
 * when conversion is impossible (e.g. HEIC on a browser that can't decode it —
 * server-side normalization is the fallback there).
 */
export async function prepareImageForUpload(
  file: File,
  maxBytes: number = MAX_UPLOAD_IMAGE_BYTES,
): Promise<File> {
  const needsReencode = !WEB_SAFE_IMAGE_TYPES.has(file.type.toLowerCase());

  if (!needsReencode && file.size <= maxBytes) {
    return file;
  }

  const reencoded = await reencodeToJpeg(file);
  if (!reencoded) {
    console.warn('[ImageUpload] Could not re-encode image, using original', {
      name: file.name,
      type: file.type,
      size: file.size,
    });
    return file;
  }

  console.info('[ImageUpload] Re-encoded image to JPEG', {
    name: file.name,
    type: file.type,
    beforeBytes: file.size,
    afterBytes: reencoded.size,
  });

  // Keep the JPEG when the original format isn't web-safe, even if it's larger.
  if (needsReencode || reencoded.size < file.size) {
    return reencoded;
  }
  return file;
}

/** Decode via createImageBitmap, downscale to max 2000px, and encode as JPEG. */
async function reencodeToJpeg(file: File): Promise<File | null> {
  if (typeof createImageBitmap === 'undefined') {
    return null;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 2000;
    const { width, height } = bitmap;
    let targetWidth = width;
    let targetHeight = height;

    if (width > height && width > maxDim) {
      targetWidth = maxDim;
      targetHeight = Math.round((maxDim / width) * height);
    } else if (height >= width && height > maxDim) {
      targetHeight = maxDim;
      targetWidth = Math.round((maxDim / height) * width);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create compressed blob'));
        },
        'image/jpeg',
        0.8,
      );
    });

    const baseName = (file.name || 'photo').replace(/\.[^/.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpeg`, { type: 'image/jpeg' });
  } catch (err) {
    console.warn('[ImageUpload] JPEG re-encode failed', err);
    return null;
  }
}
