//
//  Hey IT's TIM HELLO, WHAT ARE YOU DOING HERE?
// 
// 
'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import type { Database } from '@kit/supabase/database';
import { revalidatePath } from 'next/cache';

type ServerClient = ReturnType<typeof getSupabaseServerClient<Database>>;

const ARTWORKS_BUCKET = 'artworks';

/**
 * Infer MIME type from file extension when the browser omits it.
 * Older Android WebViews, Windows file pickers, and some mobile browsers
 * can send files with an empty or generic content type.
 */
function inferContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  };
  return map[ext] ?? 'image/jpeg';
}

export async function createArtworksBatch(formData: FormData, userId: string) {
  console.log('[createArtworksBatch] Starting for userId:', userId);
  try {
    const client = getSupabaseServerClient();
    
    // Get form data
    const images = formData.getAll('images') as File[];
    const titles = formData.getAll('titles') as string[];
    const description = formData.get('description') as string || '';
    const artistName = formData.get('artistName') as string || '';
    const medium = formData.get('medium') as string || '';

    console.log('[createArtworksBatch] Received', images.length, 'images for userId:', userId);

    // Reject empty or invalid file entries (e.g. iOS sometimes sends empty FormData parts)
    const validImages: File[] = [];
    const validTitles: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      if (file && typeof file.arrayBuffer === 'function' && file.size > 0) {
        validImages.push(file);
        validTitles.push(titles[i] ?? '');
      } else {
        console.warn('[createArtworksBatch] Skipping invalid/empty file at index', i, file ? { name: file.name, size: file?.size } : 'missing');
      }
    }

    if (validImages.length === 0) {
      console.warn('[createArtworksBatch] No valid images after filtering for userId:', userId);
      return { error: 'No valid images received. If you\'re on a phone, try choosing smaller photos or one image at a time (max 10MB each).' };
    }

    // Use validated arrays for the rest of the flow
    if (validImages.length !== validTitles.length) {
      console.warn('[createArtworksBatch] Image/title count mismatch after filter:', validImages.length, 'vs', validTitles.length);
      return { error: 'Each image must have a title' };
    }

    // Ensure account exists
    const { data: account, error: accountError } = await client
      .from('accounts')
      .select('id')
      .eq('id', userId)
      .single();

    if (accountError || !account) {
      const { data: newAccount, error: createAccountError } = await client
        .from('accounts')
        .insert({
          id: userId,
          name: 'User',
          email: null,
        })
        .select('id')
        .single();

      if (createAccountError || !newAccount) {
        console.error('Error creating/finding account:', createAccountError);
        return { error: 'Account not found. Please complete your profile setup first.' };
      }
    }

    // Process all artworks
    const artworkIds: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < validImages.length; i++) {

      
      const imageFile = validImages[i];
      const title = validTitles[i];

      if (!title || !title.trim()) {
        errors.push(`Image ${i + 1} is missing a title`);
        continue;
      }

      try {
        console.log(`[createArtworksBatch] Processing artwork ${i + 1}/${validImages.length}:`, {
          name: imageFile.name,
          size: imageFile.size,
          type: imageFile.type,
          title,
        });

        const imageUrl = await uploadArtworkImage(client, imageFile, userId);
        if (!imageUrl) {
          console.error(`[createArtworksBatch] Upload returned no URL for artwork ${i + 1}`);
          errors.push(`Failed to upload image ${i + 1}`);
          continue;
        }
        console.log(`[createArtworksBatch] Artwork ${i + 1} uploaded:`, imageUrl);

        const certificateNumber = await generateCertificateNumber(client);

        const { data: artwork, error } = await (client as any)
          .from('artworks')
          .insert({
            account_id: userId,
            title: title.trim(),
            description,
            artist_name: artistName,
            medium,
            image_url: imageUrl,
            certificate_number: certificateNumber,
            status: 'verified',
            created_by: userId,
            updated_by: userId,
          })
          .select('id')
          .single();

        if (error) {
          console.error(`[createArtworksBatch] DB insert failed for artwork ${i + 1}:`, error);
          errors.push(`Failed to create artwork ${i + 1}: ${error.message}`);
        } else if (artwork) {
          console.log(`[createArtworksBatch] Artwork ${i + 1} created:`, artwork.id);
          artworkIds.push(artwork.id);
        }
      } catch (error: any) {
        console.error(`[createArtworksBatch] Unexpected error on artwork ${i + 1}:`, error);
        errors.push(`Error processing artwork ${i + 1}: ${error.message || 'Unknown error'}`);
      }
    }

    if (artworkIds.length === 0) {
      console.error('[createArtworksBatch] All artworks failed for userId:', userId, 'errors:', errors);
      return { 
        error: errors.length > 0 
          ? `Failed to create artworks: ${errors.join('; ')}`
          : 'Failed to create any artworks'
      };
    }

    if (errors.length > 0) {
      console.warn('[createArtworksBatch] Partial success for userId:', userId, '| succeeded:', artworkIds.length, '| failed:', errors.length, errors);
    } else {
      console.log('[createArtworksBatch] All artworks created successfully for userId:', userId, '| ids:', artworkIds);
    }

    revalidatePath('/artworks');

    return { 
      artworkIds,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('[createArtworksBatch] Unexpected error for userId:', userId, error);
    return { error: 'An unexpected error occurred' };
  }
}

async function uploadArtworkImage(
  client: ServerClient,
  file: File,
  userId: string,
): Promise<string | null> {
  try {
    const adminClient = getSupabaseServerAdminClient();
    const { data: buckets } = await adminClient.storage.listBuckets();
    
    const bucketExists = buckets?.some(b => b.id === ARTWORKS_BUCKET);
    console.log('[uploadArtworkImage] Bucket exists:', bucketExists);
    
    if (!bucketExists) {
      console.log('[uploadArtworkImage] Creating bucket:', ARTWORKS_BUCKET);
      const { error: createError } = await adminClient.storage.createBucket(ARTWORKS_BUCKET, {
        public: true,
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'image/heic',
          'image/heif',
          'image/bmp',
          'image/tiff',
        ],
        fileSizeLimit: 10485760, // 10MB
      });
      
      if (createError) {
        console.error('[uploadArtworkImage] Error creating bucket:', createError);
      }
    }

    const bytes = await file.arrayBuffer();
    const bucket = client.storage.from(ARTWORKS_BUCKET);
    const rawExt = file.name.split('.').pop()?.toLowerCase() ?? '';
    const extension = /^(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/i.test(rawExt) ? rawExt : 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    const contentType = inferContentType(file);

    console.log('[uploadArtworkImage] Uploading to path:', fileName, '| contentType:', contentType, '| size:', file.size);
    const { data: uploadData, error: uploadError } = await bucket.upload(fileName, bytes, {
      contentType,
      upsert: false,
    });

    if (uploadError) {
      console.error('[uploadArtworkImage] Upload failed:', { fileName, error: uploadError });
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        throw new Error('Storage bucket not found. Please run the database migration to create the artworks bucket.');
      }
      throw new Error(`Upload failed: ${uploadError.message || 'Unknown error'}`);
    }

    console.log('[uploadArtworkImage] Upload succeeded, getting public URL for:', fileName);
    const { data: urlData } = bucket.getPublicUrl(fileName);
    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('[uploadArtworkImage] Error:', error);
    throw error;
  }
}

async function generateCertificateNumber(
  client: ServerClient,
): Promise<string> {
  try {
    const { data, error } = await (client as unknown as any).rpc('generate_certificate_number');
    if (!error && data) {
      return data;
    }
  } catch (error) {
    console.error('Error calling generate_certificate_number:', error);
  }

  // Fallback: generate client-side
  let certificateNumber: string;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    certificateNumber = `PROV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const { data } = await (client as any)
      .from('artworks')
      .select('id')
      .eq('certificate_number', certificateNumber)
      .single();
    
    exists = !!data;
    attempts++;
  }

  if (exists) {
    throw new Error('Failed to generate unique certificate number');
  }

  return certificateNumber!;
}

