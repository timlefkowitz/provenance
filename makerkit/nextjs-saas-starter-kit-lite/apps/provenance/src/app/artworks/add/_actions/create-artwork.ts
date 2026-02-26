'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import type { Database } from '@kit/supabase/database';
import { revalidatePath } from 'next/cache';

const ARTWORKS_BUCKET = 'artworks';
type ServerClient = ReturnType<typeof getSupabaseServerClient<Database>>;

export async function createArtwork(formData: FormData, userId: string) {
  console.log('[createArtwork] Starting for userId:', userId);
  try {
    const client = getSupabaseServerClient();
    
    // Get form data
    const imageFile = formData.get('image') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';
    const artistName = formData.get('artistName') as string || '';
    const medium = formData.get('medium') as string || '';

    if (!imageFile || !title) {
      console.warn('[createArtwork] Validation failed - missing title or image for userId:', userId);
      return { error: 'Title and image are required' };
    }

    console.log('[createArtwork] File details:', {
      name: imageFile.name,
      size: imageFile.size,
      type: imageFile.type,
    });

    // Ensure account exists (should be created by trigger, but verify)
    const { data: account, error: accountError } = await client
      .from('accounts')
      .select('id')
      .eq('id', userId)
      .single();

    if (accountError || !account) {
      // Account doesn't exist, try to create it
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

    // Upload image to Supabase Storage
    let imageUrl: string;
    try {
      console.log('[createArtwork] Uploading image to storage...');
      imageUrl = await uploadArtworkImage(client, imageFile, userId) || '';
      if (!imageUrl) {
        console.error('[createArtwork] Upload returned no URL for userId:', userId);
        return { error: 'Failed to upload image: No URL returned' };
      }
      console.log('[createArtwork] Image uploaded successfully:', imageUrl);
    } catch (uploadError: any) {
      console.error('[createArtwork] Upload error for userId:', userId, uploadError);
      return { error: uploadError?.message || 'Failed to upload image. Please check that the storage bucket exists.' };
    }

    // Generate certificate number
    const certificateNumber = await generateCertificateNumber(client);

    // Create artwork record
    console.log('[createArtwork] Inserting artwork record for userId:', userId);
    const { data: artwork, error } = await (client as any)
      .from('artworks')
      .insert({
        account_id: userId,
        title,
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
      console.error('[createArtwork] DB insert failed for userId:', userId, error);
      return { error: error.message || 'Failed to create artwork' };
    }

    console.log('[createArtwork] Artwork created successfully:', artwork.id);
    revalidatePath('/artworks');
    revalidatePath(`/artworks/${artwork.id}`);

    return { artworkId: artwork.id };
  } catch (error) {
    console.error('[createArtwork] Unexpected error for userId:', userId, error);
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
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 10485760, // 10MB
      });
      
      if (createError) {
        console.error('[uploadArtworkImage] Error creating bucket:', createError);
      }
    }

    const bytes = await file.arrayBuffer();
    const bucket = client.storage.from(ARTWORKS_BUCKET);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

    console.log('[uploadArtworkImage] Uploading to path:', fileName, '| contentType:', file.type, '| size:', file.size);
    const { data: uploadData, error: uploadError } = await bucket.upload(fileName, bytes, {
      contentType: file.type,
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
  // Try to use the database function, fallback to client-side generation
  try {
    const { data, error } = await (client as unknown as any).rpc(
      'generate_certificate_number',
    );
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
