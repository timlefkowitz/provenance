/**
 * Single module for artwork image storage: public URL helper and the one class that handles uploads.
 * All artwork image uploads (add flow, edit flow) must go through ArtworkImageUploader.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports -- heic-convert is CJS, no ESM build
const convert = require('heic-convert') as (opts: { buffer: Buffer; format: 'JPEG' | 'PNG'; quality?: number }) => Promise<Buffer>;
import sharp from 'sharp';

const ARTWORKS_BUCKET = 'artworks';

function isHeicSignature(input: ArrayBuffer): boolean {
  const bytes = new TextDecoder().decode(new Uint8Array(input.slice(4, 12)));
  return bytes.includes('ftypheic') || bytes.includes('ftypheif') || bytes.includes('ftypmif1');
}

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
    from: (bucket: string) => {
      upload: (path: string, body: ArrayBuffer, opts: { contentType: string; upsert: boolean }) => Promise<{ error: { message?: string } | null }>;
    };
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

    let bytes = await file.arrayBuffer();
    const { extension: origExt, contentType: origContentType } = getContentTypeAndExtension(file);
    let extension = origExt;
    let contentType = origContentType;

    // Convert to standard JPEG so HEIC and browser-unfriendly formats display on certificate.
    const converted = await normalizeToJpeg(bytes);
    if (converted) {
      bytes = converted;
      extension = 'jpeg';
      contentType = 'image/jpeg';
      console.info('[ArtworkUpload] Normalized image to JPEG for storage', { original: file.name });
    }

    const signature = getBinarySignature(bytes);
    // Use admin storage client for the actual upload so this server action path
    // does not fail when storage RLS/session propagation is inconsistent.
    const bucket = adminClient.storage.from(ARTWORKS_BUCKET);
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    console.info('[ArtworkUpload] Starting upload', {
      file: fileLabel,
      contentType,
      storagePath: fileName,
      bucket: ARTWORKS_BUCKET,
      strategy: 'admin-first',
      signatureHex: signature.hex,
      signatureAscii: signature.ascii,
    });

    const firstUpload = await bucket.upload(fileName, bytes, {
      contentType,
      upsert: false,
    });
    let uploadError = firstUpload.error;

    // Keep upload path lean: only create bucket on-demand if upload says it's missing.
    if (uploadError && isBucketMissingError(uploadError.message)) {
      console.warn('[ArtworkUpload] Bucket missing, attempting create-and-retry', {
        bucket: ARTWORKS_BUCKET,
        storagePath: fileName,
        error: uploadError.message ?? uploadError,
      });
      const { error: createError } = await adminClient.storage.createBucket(ARTWORKS_BUCKET, {
        public: true,
        allowedMimeTypes: [...ALLOWED_MIME_TYPES],
        fileSizeLimit: FILE_SIZE_LIMIT,
      });

      // Retry once after ensuring bucket exists.
      if (!createError || isAlreadyExistsError(createError.message)) {
        const retryUpload = await bucket.upload(fileName, bytes, {
          contentType,
          upsert: false,
        });
        uploadError = retryUpload.error;
        if (!uploadError) {
          console.info('[ArtworkUpload] Upload succeeded after bucket create/retry', {
            storagePath: fileName,
          });
        }
      } else {
        console.error('[ArtworkUpload] Bucket create failed', {
          bucket: ARTWORKS_BUCKET,
          error: createError.message ?? createError,
        });
      }
    }

    // If admin upload still failed (often due to invalid/missing service role key in env),
    // fall back to authenticated client upload so RLS-enabled environments keep working.
    if (uploadError) {
      console.warn('[ArtworkUpload] Admin upload failed, trying authenticated fallback', {
        storagePath: fileName,
        error: uploadError.message ?? uploadError,
      });
      const userBucket = client.storage.from(ARTWORKS_BUCKET);
      const userUpload = await userBucket.upload(fileName, bytes, {
        contentType,
        upsert: false,
      });
      if (!userUpload.error) {
        console.info('[ArtworkUpload] Authenticated fallback upload succeeded', {
          storagePath: fileName,
        });
        return getArtworkImagePublicUrl(fileName);
      }
      uploadError = userUpload.error;
      console.error('[ArtworkUpload] Authenticated fallback upload failed', {
        storagePath: fileName,
        error: uploadError.message ?? uploadError,
      });
    }

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

function isBucketMissingError(message?: string): boolean {
  const msg = (message ?? '').toLowerCase();
  return msg.includes('bucket not found') || msg.includes('not found');
}

function isAlreadyExistsError(message?: string): boolean {
  const msg = (message ?? '').toLowerCase();
  return msg.includes('already exists') || msg.includes('duplicate');
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

function getBinarySignature(input: ArrayBuffer): { hex: string; ascii: string } {
  const bytes = Array.from(new Uint8Array(input.slice(0, 16)));
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = bytes
    .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
    .join('');
  return { hex, ascii };
}

/** Convert image to standard JPEG. Returns buffer on success, null if conversion fails. */
async function normalizeToJpeg(input: ArrayBuffer): Promise<ArrayBuffer | null> {
  const buf = Buffer.from(input);

  // HEIC: sharp often lacks libheif; use heic-convert.
  if (isHeicSignature(input)) {
    try {
      const out = await convert({
        buffer: buf,
        format: 'JPEG',
        quality: 0.9,
      });
      return new Uint8Array(out).buffer as ArrayBuffer;
    } catch (e) {
      console.warn('[ArtworkUpload] heic-convert failed:', e instanceof Error ? e.message : e);
      return null;
    }
  }

  // Standard formats: use sharp.
  try {
    const out = await sharp(buf)
      .rotate() // Auto-rotate from EXIF
      .jpeg({ quality: 90 })
      .toBuffer();
    return new Uint8Array(out).buffer as ArrayBuffer;
  } catch {
    return null;
  }
}
