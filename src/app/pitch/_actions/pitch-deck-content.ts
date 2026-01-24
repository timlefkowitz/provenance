'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '~/lib/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const PITCH_DECK_CONTENT_PATH = path.join(process.cwd(), 'data', 'pitch-deck-content.json');

export type PitchDeckSlide = {
  id: number;
  title: string;
  subtitle?: string;
  tagline?: string;
  content?: string[]; // Legacy format - array of strings
  markdown?: string; // New format - markdown string
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

