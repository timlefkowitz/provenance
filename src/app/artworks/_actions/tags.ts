'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { revalidatePath } from 'next/cache';

export type Tag = {
  id: string;
  name: string;
  slug: string;
};

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function listMyTags(): Promise<Tag[]> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const { data, error } = await client
    .from('tags')
    .select('id, name, slug')
    .eq('account_id', user.id)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Tags] listMyTags failed', error);
    return [];
  }

  return data ?? [];
}

export async function createTag(name: string): Promise<{ success: boolean; tag?: Tag; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: 'Tag name is required' };
  }

  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false, error: 'You must be signed in' };
  }

  const { data, error } = await client
    .from('tags')
    .insert({ account_id: user.id, name: trimmed, slug: slugify(trimmed) })
    .select('id, name, slug')
    .single();

  if (error) {
    // Unique violation: tag already exists for this account, return it instead of failing.
    if (error.code === '23505') {
      const { data: existing } = await client
        .from('tags')
        .select('id, name, slug')
        .eq('account_id', user.id)
        .ilike('name', trimmed)
        .maybeSingle();
      if (existing) {
        return { success: true, tag: existing };
      }
    }
    console.error('[Tags] createTag failed', error);
    return { success: false, error: 'Could not create tag' };
  }

  return { success: true, tag: data };
}

export async function getArtworkTags(artworkId: string): Promise<Tag[]> {
  const client = asUntyped(getSupabaseServerClient());

  const { data, error } = await client
    .from('artwork_tags')
    .select('tags(id, name, slug)')
    .eq('artwork_id', artworkId);

  if (error) {
    console.error('[Tags] getArtworkTags failed', error);
    return [];
  }

  return (data ?? [])
    .flatMap((row: { tags: Tag | Tag[] }) => (Array.isArray(row.tags) ? row.tags : [row.tags]))
    .filter(Boolean);
}

export async function setArtworkTags(
  artworkId: string,
  tagIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false, error: 'You must be signed in' };
  }

  const { data: artwork, error: artworkError } = await client
    .from('artworks')
    .select('id, account_id')
    .eq('id', artworkId)
    .single();

  if (artworkError || !artwork || artwork.account_id !== user.id) {
    return { success: false, error: 'Artwork not found' };
  }

  const dedupedTagIds = Array.from(new Set(tagIds)).slice(0, 24);

  const { error: deleteError } = await client.from('artwork_tags').delete().eq('artwork_id', artworkId);
  if (deleteError) {
    console.error('[Tags] setArtworkTags delete failed', deleteError);
    return { success: false, error: 'Could not update tags' };
  }

  if (dedupedTagIds.length > 0) {
    const { error: insertError } = await client
      .from('artwork_tags')
      .insert(dedupedTagIds.map((tagId) => ({ artwork_id: artworkId, tag_id: tagId })));
    if (insertError) {
      console.error('[Tags] setArtworkTags insert failed', insertError);
      return { success: false, error: 'Could not update tags' };
    }
  }

  revalidatePath(`/artworks/${artworkId}`);
  return { success: true };
}
