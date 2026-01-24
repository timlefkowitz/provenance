'use server';

import { revalidatePath } from 'next/cache';
import { isAdmin } from '~/lib/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

const PITCH_DECK_KEY = 'main';
const PITCH_DECK_IMAGES_BUCKET = 'pitch-deck-images';

export type PitchDeckSlide = {
  id: number;
  title: string;
  subtitle?: string;
  tagline?: string;
  content?: string[]; // Legacy format - array of strings
  markdown?: string; // New format - markdown string
  image_url?: string; // URL path to slide image
  table?: Array<{
    solution: string;
    artistFirst: string;
    immutable: string;
    fullLifecycle: string;
  }>;
  footer?: string;
  type: string;
};

export type PitchDeckContent = {
  slides: PitchDeckSlide[];
};

/**
 * Read pitch deck content from database
 */
export async function getPitchDeckContent(): Promise<PitchDeckContent> {
  try {
    const client = getSupabaseServerClient();
    
    const { data, error } = await client
      .from('pitch_deck_content')
      .select('content')
      .eq('key', PITCH_DECK_KEY)
      .single();

    if (error) {
      // If not found, return empty content
      if (error.code === 'PGRST116') {
        console.log('Pitch deck content not found, returning empty content');
        return { slides: [] };
      }
      throw error;
    }

    return (data?.content as PitchDeckContent) || { slides: [] };
  } catch (error) {
    console.error('Error reading pitch deck content:', error);
    // Return empty content as fallback
    return { slides: [] };
  }
}

/**
 * Update pitch deck content (admin only)
 */
export async function updatePitchDeckContent(content: PitchDeckContent) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to update pitch deck content' };
    }

    // Validate content structure
    if (!content.slides || !Array.isArray(content.slides)) {
      return { error: 'Invalid content structure' };
    }

    // Upsert to database
    const { error: dbError } = await client
      .from('pitch_deck_content')
      .upsert({
        key: PITCH_DECK_KEY,
        content: content as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      });

    if (dbError) {
      throw dbError;
    }

    // Revalidate the pitch page
    revalidatePath('/pitch');

    return { success: true };
  } catch (error) {
    console.error('Error updating pitch deck content:', error);
    return { error: error instanceof Error ? error.message : 'Failed to update pitch deck content' };
  }
}

/**
 * Upload slide image (admin only)
 */
export async function uploadSlideImage(slideId: number, formData: FormData) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to upload images' };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return { error: 'No file provided' };
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { error: 'File must be an image' };
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { error: 'File size must be less than 5MB' };
    }

    // Ensure bucket exists
    const adminClient = getSupabaseServerAdminClient();
    const { data: buckets } = await adminClient.storage.listBuckets();
    
    const bucketExists = buckets?.some(b => b.id === PITCH_DECK_IMAGES_BUCKET);
    
    if (!bucketExists) {
      const { error: createError } = await adminClient.storage.createBucket(PITCH_DECK_IMAGES_BUCKET, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 5242880, // 5MB
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
      }
    }

    // Upload to Supabase Storage
    const bytes = await file.arrayBuffer();
    const bucket = client.storage.from(PITCH_DECK_IMAGES_BUCKET);
    const extension = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const fileName = `slide-${slideId}-${timestamp}.${extension}`;

    const { error: uploadError } = await bucket.upload(fileName, bytes, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return { error: `Upload failed: ${uploadError.message || 'Unknown error'}` };
    }

    // Get public URL
    const { data: urlData } = bucket.getPublicUrl(fileName);
    if (!urlData?.publicUrl) {
      return { error: 'Failed to get public URL for uploaded image' };
    }

    const imageUrl = urlData.publicUrl;

    // Update the database with the new image URL
    const content = await getPitchDeckContent();
    const slideIndex = content.slides.findIndex(s => s.id === slideId);
    if (slideIndex !== -1) {
      content.slides[slideIndex].image_url = imageUrl;
      await updatePitchDeckContent(content);
    }

    revalidatePath('/pitch');
    revalidatePath('/admin/pitch');

    return { success: true, imageUrl };
  } catch (error) {
    console.error('Error uploading slide image:', error);
    return { error: error instanceof Error ? error.message : 'Failed to upload image' };
  }
}

/**
 * Delete slide image (admin only)
 */
export async function deleteSlideImage(slideId: number) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return { error: 'You do not have permission to delete images' };
    }

    // Get the content to find the slide
    const content = await getPitchDeckContent();
    const slideIndex = content.slides.findIndex(s => s.id === slideId);
    
    if (slideIndex === -1) {
      return { error: 'Slide not found' };
    }

    const slide = content.slides[slideIndex];
    if (!slide.image_url) {
      return { error: 'No image to delete' };
    }

    // Extract filename from URL (handle both storage URLs and old file paths)
    const imageUrl = slide.image_url;
    let fileName: string | null = null;
    
    if (imageUrl.includes('/storage/v1/object/public/')) {
      // Supabase Storage URL format
      const urlParts = imageUrl.split('/');
      const bucketIndex = urlParts.findIndex(part => part === 'public') + 1;
      fileName = urlParts.slice(bucketIndex).join('/');
    } else {
      // Old file path format
      fileName = imageUrl.split('/').pop() || null;
    }

    // Delete from Supabase Storage
    if (fileName) {
      const bucket = client.storage.from(PITCH_DECK_IMAGES_BUCKET);
      const { error: deleteError } = await bucket.remove([fileName]);
      
      if (deleteError) {
        console.warn('Could not delete image from storage:', deleteError);
        // Continue anyway to remove the reference
      }
    }

    // Remove image URL from slide
    content.slides[slideIndex].image_url = undefined;
    await updatePitchDeckContent(content);

    revalidatePath('/pitch');
    revalidatePath('/admin/pitch');

    return { success: true };
  } catch (error) {
    console.error('Error deleting slide image:', error);
    return { error: error instanceof Error ? error.message : 'Failed to delete image' };
  }
}

