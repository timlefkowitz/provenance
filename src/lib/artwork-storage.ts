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

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

/**
 * Single source of truth: upload an artwork image to Supabase Storage and return its public URL.
 * Call from server actions only (pass getSupabaseServerClient() and getSupabaseServerAdminClient()).
 */
export async function uploadArtworkImage(
  client: { storage: { from: (bucket: string) => { upload: (path: string, body: ArrayBuffer, opts: { contentType: string; upsert: boolean }) => Promise<{ error: { message?: string } | null }> } } },
  adminClient: { storage: { listBuckets: () => Promise<{ data: { id: string }[] | null }>; createBucket: (id: string, opts: { public: boolean; allowedMimeTypes: string[]; fileSizeLimit: number }) => Promise<{ error: { message: string } | null }> } },
  file: File,
  userId: string,
): Promise<string> {
  const { data: buckets } = await adminClient.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.id === ARTWORKS_BUCKET);
  if (!bucketExists) {
    const { error: createError } = await adminClient.storage.createBucket(ARTWORKS_BUCKET, {
      public: true,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
      fileSizeLimit: FILE_SIZE_LIMIT,
    });
    if (createError) console.error('Error creating bucket:', createError);
  }

  const bytes = await file.arrayBuffer();
  const bucket = client.storage.from(ARTWORKS_BUCKET);
  const { extension, contentType } = getContentTypeAndExtension(file);
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

  const { error: uploadError } = await bucket.upload(fileName, bytes, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
    if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
      throw new Error('Storage bucket not found. Please run the database migration to create the artworks bucket.');
    }
    throw new Error(`Upload failed: ${uploadError.message ?? 'Unknown error'}`);
  }

  return getArtworkImagePublicUrl(fileName);
}

export { ARTWORKS_BUCKET };
