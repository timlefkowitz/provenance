'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

const PROFILES_BUCKET = 'profiles';

export async function uploadProfilePicture(
  formData: FormData,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const client = getSupabaseServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();

    if (authError || !user) {
      return { url: null, error: 'You must be signed in to upload a profile picture' };
    }

    const userId = user.id;
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof File)) {
      return { url: null, error: 'No file provided' };
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { url: null, error: 'File must be an image' };
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return { url: null, error: 'Image size must be less than 5MB' };
    }
    
    // Ensure bucket exists using admin client
    try {
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
    } catch (bucketError) {
      console.error('Error checking/creating bucket:', bucketError);
      // Continue anyway - bucket might exist
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
        return { url: null, error: 'Storage bucket not found. Please contact support.' };
      }
      return { url: null, error: `Upload failed: ${uploadError.message || 'Unknown error'}` };
    }

    const { data: urlData } = bucket.getPublicUrl(fileName);
    if (!urlData?.publicUrl) {
      return { url: null, error: 'Failed to get public URL for uploaded image' };
    }
    
    return { url: urlData.publicUrl, error: null };
  } catch (error: any) {
    console.error('Error in uploadProfilePicture:', error);
    return { url: null, error: error?.message || 'An unexpected error occurred while uploading the image' };
  }
}

