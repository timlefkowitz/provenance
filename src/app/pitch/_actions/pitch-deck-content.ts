'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '~/lib/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const PITCH_DECK_CONTENT_PATH = path.join(process.cwd(), 'data', 'pitch-deck-content.json');
const PITCH_DECK_IMAGES_DIR = path.join(process.cwd(), 'public', 'data', 'pitch-deck-images');

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
 * Read pitch deck content from JSON file
 */
export async function getPitchDeckContent(): Promise<PitchDeckContent> {
  try {
    const fileContents = await fs.readFile(PITCH_DECK_CONTENT_PATH, 'utf8');
    return JSON.parse(fileContents) as PitchDeckContent;
  } catch (error) {
    // If file doesn't exist, return empty content
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('Pitch deck content file not found, creating default file...');
      const defaultContent: PitchDeckContent = {
        slides: [],
      };
      
      // Ensure data directory exists
      try {
        await fs.mkdir(path.dirname(PITCH_DECK_CONTENT_PATH), { recursive: true });
      } catch (mkdirError) {
        // Directory might already exist, ignore
      }
      
      // Write default content
      await fs.writeFile(PITCH_DECK_CONTENT_PATH, JSON.stringify(defaultContent, null, 2), 'utf8');
      return defaultContent;
    }
    
    console.error('Error reading pitch deck content:', error);
    throw new Error('Failed to read pitch deck content');
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

    // Write to file
    await fs.writeFile(PITCH_DECK_CONTENT_PATH, JSON.stringify(content, null, 2), 'utf8');

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

    // Ensure images directory exists
    await fs.mkdir(PITCH_DECK_IMAGES_DIR, { recursive: true });

    // Generate filename: slide-{id}-{timestamp}.{ext}
    const extension = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const fileName = `slide-${slideId}-${timestamp}.${extension}`;
    const filePath = path.join(PITCH_DECK_IMAGES_DIR, fileName);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filePath, buffer);

    // Return the public URL path
    const imageUrl = `/data/pitch-deck-images/${fileName}`;

    // Update the JSON file with the new image URL
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

    // Extract filename from URL
    const fileName = slide.image_url.split('/').pop();
    if (fileName) {
      const filePath = path.join(PITCH_DECK_IMAGES_DIR, fileName);
      
      // Delete the file
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        // File might not exist, continue anyway
        console.warn('Could not delete image file:', unlinkError);
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

