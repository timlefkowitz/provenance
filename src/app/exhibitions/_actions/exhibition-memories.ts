'use server';

/* eslint-disable @typescript-eslint/no-explicit-any -- memories rows use loosely typed Supabase rows */

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { artworkImageUploader } from '~/lib/artwork-storage';

export type ExhibitionMemory = {
  id: string;
  exhibition_id: string;
  user_id: string;
  author_name: string | null;
  author_avatar_url: string | null;
  body: string | null;
  image_urls: string[];
  created_at: string;
};

const MAX_MEMORY_IMAGES = 4;

/** Fetch memories for an exhibition, newest first. */
export async function getExhibitionMemories(
  exhibitionId: string,
): Promise<ExhibitionMemory[]> {
  console.log('[Exhibitions] getExhibitionMemories started', { exhibitionId });
  const client = asUntyped(getSupabaseServerClient());

  const { data, error } = await asUntyped(client)
    .from('exhibition_memories')
    .select('*')
    .eq('exhibition_id', exhibitionId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Exhibitions] getExhibitionMemories failed', error);
    return [];
  }

  console.log('[Exhibitions] getExhibitionMemories completed', {
    exhibitionId,
    count: (data || []).length,
  });

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    exhibition_id: row.exhibition_id,
    user_id: row.user_id,
    author_name: row.author_name ?? null,
    author_avatar_url: row.author_avatar_url ?? null,
    body: row.body ?? null,
    image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
    created_at: row.created_at,
  }));
}

/**
 * Post a memory (note + optional photos) about an exhibition.
 * Expects FormData: `exhibitionId`, `body`, and `image_0..image_n` files.
 */
export async function postExhibitionMemory(
  formData: FormData,
): Promise<{ success: true; memory: ExhibitionMemory } | { success: false; error: string }> {
  const exhibitionId = (formData.get('exhibitionId') as string)?.trim();
  const body = ((formData.get('body') as string) ?? '').trim();

  console.log('[Exhibitions] postExhibitionMemory started', { exhibitionId });

  if (!exhibitionId) {
    return { success: false, error: 'Missing exhibition.' };
  }

  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    console.error('[Exhibitions] postExhibitionMemory: not authenticated');
    return { success: false, error: 'You must be signed in to post a memory.' };
  }

  // Ensure the exhibition exists and is visible (published) or owned by the user.
  const { data: exhibition, error: exErr } = await asUntyped(client)
    .from('exhibitions')
    .select('id, gallery_id, published_at')
    .eq('id', exhibitionId)
    .maybeSingle();

  if (exErr || !exhibition) {
    console.error('[Exhibitions] postExhibitionMemory: exhibition not found', exErr);
    return { success: false, error: 'Exhibition not found.' };
  }

  if (!exhibition.published_at && exhibition.gallery_id !== user.id) {
    return { success: false, error: 'This exhibition is not available.' };
  }

  // Collect uploaded image files (image_0, image_1, ...).
  const files: File[] = [];
  for (let i = 0; i < MAX_MEMORY_IMAGES; i += 1) {
    const f = formData.get(`image_${i}`) as File | null;
    if (f && typeof f === 'object' && f.size > 0) {
      files.push(f);
    }
  }

  if (!body && files.length === 0) {
    return { success: false, error: 'Add a photo or a note to share a memory.' };
  }

  const adminClient = getSupabaseServerAdminClient();
  const imageUrls: string[] = [];
  for (const file of files) {
    try {
      const url = await artworkImageUploader.upload(client, adminClient, file, user.id);
      imageUrls.push(url);
    } catch (uploadErr) {
      console.error('[Exhibitions] postExhibitionMemory: image upload failed', uploadErr);
      return {
        success: false,
        error: 'Photo upload failed. Try a smaller file or another image.',
      };
    }
  }

  // Resolve a display name + avatar for attribution.
  let authorName: string | null = null;
  let authorAvatar: string | null = null;
  const { data: account } = await client
    .from('accounts')
    .select('name, picture_url')
    .eq('id', user.id)
    .maybeSingle();
  if (account) {
    authorName = (account as any).name ?? null;
    authorAvatar = (account as any).picture_url ?? null;
  }

  const { data: inserted, error: insErr } = await asUntyped(client)
    .from('exhibition_memories')
    .insert({
      exhibition_id: exhibitionId,
      user_id: user.id,
      author_name: authorName,
      author_avatar_url: authorAvatar,
      body: body || null,
      image_urls: imageUrls,
    })
    .select('*')
    .single();

  if (insErr || !inserted) {
    console.error('[Exhibitions] postExhibitionMemory: insert failed', insErr);
    return { success: false, error: 'Could not save your memory. Try again.' };
  }

  console.log('[Exhibitions] postExhibitionMemory success', {
    exhibitionId,
    memoryId: inserted.id,
    images: imageUrls.length,
  });

  revalidatePath(`/exhibitions/${exhibitionId}`);

  return {
    success: true,
    memory: {
      id: inserted.id,
      exhibition_id: inserted.exhibition_id,
      user_id: inserted.user_id,
      author_name: inserted.author_name ?? null,
      author_avatar_url: inserted.author_avatar_url ?? null,
      body: inserted.body ?? null,
      image_urls: Array.isArray(inserted.image_urls) ? inserted.image_urls : [],
      created_at: inserted.created_at,
    },
  };
}

/** Delete a memory. Allowed for the author or the exhibition host (enforced by RLS). */
export async function deleteExhibitionMemory(
  memoryId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  console.log('[Exhibitions] deleteExhibitionMemory started', { memoryId });
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be signed in.' };
  }

  const { data: memory } = await asUntyped(client)
    .from('exhibition_memories')
    .select('exhibition_id')
    .eq('id', memoryId)
    .maybeSingle();

  const { error } = await asUntyped(client)
    .from('exhibition_memories')
    .delete()
    .eq('id', memoryId);

  if (error) {
    console.error('[Exhibitions] deleteExhibitionMemory failed', error);
    return { success: false, error: 'Could not delete this memory.' };
  }

  if (memory?.exhibition_id) {
    revalidatePath(`/exhibitions/${memory.exhibition_id}`);
  }

  console.log('[Exhibitions] deleteExhibitionMemory success', { memoryId });
  return { success: true };
}
