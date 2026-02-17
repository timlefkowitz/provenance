/**
 * Build the public URL for an artwork image using the app's Supabase URL.
 * Using NEXT_PUBLIC_SUPABASE_URL ensures the stored URL matches Next.js
 * image remotePatterns and loads correctly on /artworks and certificate pages.
 */
const ARTWORKS_BUCKET = 'artworks';

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * Return a safe extension and Content-Type for storage. Prefer the file's
 * declared type so we don't store JPEG bytes with .heic extension (which
 * can make the file unrenderable). Fall back to extension from name.
 */
export function getContentTypeAndExtension(
  file: { name: string; type: string }
): { extension: string; contentType: string } {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') {
    return { extension: 'jpeg', contentType: 'image/jpeg' };
  }
  if (type === 'image/png') return { extension: 'png', contentType: 'image/png' };
  if (type === 'image/webp') return { extension: 'webp', contentType: 'image/webp' };
  if (type === 'image/gif') return { extension: 'gif', contentType: 'image/gif' };
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/heic/i, 'jpeg');
  const contentType = EXT_TO_MIME[ext] || 'image/jpeg';
  const extension = ext in EXT_TO_MIME ? ext : 'jpeg';
  return { extension, contentType };
}

export function getArtworkImagePublicUrl(filePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/storage/v1/object/public/${ARTWORKS_BUCKET}/${filePath}`;
}

export { ARTWORKS_BUCKET };
