/**
 * Single module for artwork image storage: public URL helper and the one class that handles uploads.
 * All artwork image uploads (add flow, edit flow) must go through ArtworkImageUploader.
 */

const ARTWORKS_BUCKET = 'artworks';

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

export type ArtworkStorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: ArrayBuffer, opts: { contentType: string; upsert: boolean }) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

export type ArtworkStorageAdminClient = {
  storage: {
    listBuckets: () => Promise<{ data: { id: string }[] | null }>;
    createBucket: (id: string, opts: { public: boolean; allowedMimeTypes: string[]; fileSizeLimit: number }) => Promise<{ error: { message: string } | null }>;
  };
};

/**
 * The only class that handles artwork image uploads. Use the singleton artworkImageUploader.
 */
export class ArtworkImageUploader {
  /**
   * Upload an artwork image to Supabase Storage and return its public URL.
   * Call from server actions only (pass getSupabaseServerClient() and getSupabaseServerAdminClient()).
   */
  async upload(
    client: ArtworkStorageClient,
    adminClient: ArtworkStorageAdminClient,
    file: File,
    userId: string,
  ): Promise<string> {
    const fileLabel = `${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`;

    const { data: buckets } = await adminClient.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.id === ARTWORKS_BUCKET);
    if (!bucketExists) {
      console.error('[ArtworkUpload] Bucket missing, creating:', ARTWORKS_BUCKET);
      const { error: createError } = await adminClient.storage.createBucket(ARTWORKS_BUCKET, {
        public: true,
        allowedMimeTypes: [...ALLOWED_MIME_TYPES],
        fileSizeLimit: FILE_SIZE_LIMIT,
      });
      if (createError) {
        console.error('[ArtworkUpload] Bucket create failed:', createError.message ?? createError);
      }
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
      console.error('[ArtworkUpload] Storage upload failed:', {
        file: fileLabel,
        storagePath: fileName,
        contentType,
        error: uploadError.message ?? uploadError,
      });
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        throw new Error('Storage bucket not found. Please run the database migration to create the artworks bucket.');
      }
      throw new Error(`Upload failed: ${uploadError.message ?? 'Unknown error'}`);
    }

    return getArtworkImagePublicUrl(fileName);
  }
}

function getContentTypeAndExtension(file: { name: string; type: string }): { extension: string; contentType: string } {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') return { extension: 'jpeg', contentType: 'image/jpeg' };
  if (type === 'image/png') return { extension: 'png', contentType: 'image/png' };
  if (type === 'image/webp') return { extension: 'webp', contentType: 'image/webp' };
  if (type === 'image/gif') return { extension: 'gif', contentType: 'image/gif' };
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/heic/i, 'jpeg');
  const contentType = EXT_TO_MIME[ext] || 'image/jpeg';
  const extension = ext in EXT_TO_MIME ? ext : 'jpeg';
  return { extension, contentType };
}

/** Build the public URL for an artwork image (e.g. for display). Uses app Supabase URL for Next.js image remotePatterns. */
export function getArtworkImagePublicUrl(filePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/storage/v1/object/public/${ARTWORKS_BUCKET}/${filePath}`;
}

/** Single instance: the only handler for artwork image uploads. */
export const artworkImageUploader = new ArtworkImageUploader();

export { ARTWORKS_BUCKET };
