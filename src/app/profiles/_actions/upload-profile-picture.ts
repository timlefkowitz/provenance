'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

const PROFILES_BUCKET = 'profiles';

export async function uploadProfilePicture(
  formData: FormData,
): Promise<string | null> {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      throw new Error('You must be signed in to upload a profile picture');
    }

    const userId = user.id;
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }
    
    // Ensure bucket exists using admin client
    const adminClient = getSupabaseServerAdminClient();
    const { data: buckets } = await adminClient.storage.listBuckets();
    
    const bucketExists = buckets?.some(b => b.id === PROFILES_BUCKET);
    
    if (!bucketExists) {
      // Create the bucket using admin client
      const { error: createError } = await adminClient.storage.createBucket(PROFILES_BUCKET, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 5242880, // 5MB
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
        // If bucket creation fails, it might already exist or we don't have permissions
        // Continue and try to upload anyway
      }
    }

    const bytes = await file.arrayBuffer();
    const bucket = client.storage.from(PROFILES_BUCKET);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

    const { data: uploadData, error: uploadError } = await bucket.upload(fileName, bytes, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error('Error uploading profile picture:', uploadError);
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        throw new Error('Storage bucket not found. Please contact support.');
      }
      throw new Error(`Upload failed: ${uploadError.message || 'Unknown error'}`);
    }

    const { data: urlData } = bucket.getPublicUrl(fileName);
    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadProfilePicture:', error);
    throw error;
  }
}

