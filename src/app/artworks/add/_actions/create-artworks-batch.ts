'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';

const ARTWORKS_BUCKET = 'artworks';

export async function createArtworksBatch(formData: FormData, userId: string) {
  try {
    const client = getSupabaseServerClient();
    
    // Get form data
    const images = formData.getAll('images') as File[];
    const titles = formData.getAll('titles') as string[];
    const description = formData.get('description') as string || '';
    const artistName = formData.get('artistName') as string || '';
    const medium = formData.get('medium') as string || '';
    const isPublic = formData.get('isPublic') === 'true'; // Default to true if not provided

    if (!images || images.length === 0) {
      return { error: 'At least one image is required' };
    }

    if (images.length !== titles.length) {
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

    for (let i = 0; i < images.length; i++) {
      const imageFile = images[i];
      const title = titles[i];

      if (!title || !title.trim()) {
        errors.push(`Image ${i + 1} is missing a title`);
        continue;
      }

      try {
        // Upload image
        const imageUrl = await uploadArtworkImage(client, imageFile, userId);
        if (!imageUrl) {
          errors.push(`Failed to upload image ${i + 1}`);
          continue;
        }

        // Generate certificate number
        const certificateNumber = await generateCertificateNumber(client);

        // Create artwork record
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
            is_public: isPublic,
            created_by: userId,
            updated_by: userId,
          })
          .select('id')
          .single();

        if (error) {
          console.error(`Error creating artwork ${i + 1}:`, error);
          errors.push(`Failed to create artwork ${i + 1}: ${error.message}`);
        } else if (artwork) {
          artworkIds.push(artwork.id);
        }
      } catch (error: any) {
        console.error(`Error processing artwork ${i + 1}:`, error);
        errors.push(`Error processing artwork ${i + 1}: ${error.message || 'Unknown error'}`);
      }
    }

    if (artworkIds.length === 0) {
      return { 
        error: errors.length > 0 
          ? `Failed to create artworks: ${errors.join('; ')}`
          : 'Failed to create any artworks'
      };
    }

    if (errors.length > 0) {
      // Some succeeded, some failed
      console.warn('Some artworks failed to create:', errors);
    }

    revalidatePath('/artworks');

    return { 
      artworkIds,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('Error in createArtworksBatch:', error);
    return { error: 'An unexpected error occurred' };
  }
}

async function uploadArtworkImage(
  client: ReturnType<typeof getSupabaseServerClient>,
  file: File,
  userId: string,
): Promise<string | null> {
  try {
    // Ensure bucket exists using admin client
    const adminClient = getSupabaseServerAdminClient();
    const { data: buckets } = await adminClient.storage.listBuckets();
    
    const bucketExists = buckets?.some(b => b.id === ARTWORKS_BUCKET);
    
    if (!bucketExists) {
      const { error: createError } = await adminClient.storage.createBucket(ARTWORKS_BUCKET, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 10485760, // 10MB
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
      }
    }

    const bytes = await file.arrayBuffer();
    const bucket = client.storage.from(ARTWORKS_BUCKET);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

    const { data: uploadData, error: uploadError } = await bucket.upload(fileName, bytes, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        throw new Error('Storage bucket not found. Please run the database migration to create the artworks bucket.');
      }
      throw new Error(`Upload failed: ${uploadError.message || 'Unknown error'}`);
    }

    const { data: urlData } = bucket.getPublicUrl(fileName);
    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadArtworkImage:', error);
    throw error;
  }
}

async function generateCertificateNumber(
  client: ReturnType<typeof getSupabaseServerClient>,
): Promise<string> {
  try {
    const { data, error } = await client.rpc('generate_certificate_number');
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
    const { data } = await client
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

