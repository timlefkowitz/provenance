'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { readCollectionLinks, type CollectionLink } from '~/lib/collection-links';

/** The signed-in user's saved collection links (empty when signed out). */
export async function getCollectionLinks(): Promise<CollectionLink[]> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  const { data, error } = await client.from('accounts').select('public_data').eq('id', user.id).single();
  if (error) {
    console.error('[CollectionLinks] Load failed', error);
    return [];
  }
  return readCollectionLinks((data?.public_data as Record<string, unknown> | null)?.collection_links);
}

/** Replaces the saved links; returns what was stored after cleaning. */
export async function saveCollectionLinks(
  links: CollectionLink[],
): Promise<{ success: true; links: CollectionLink[] } | { success: false; error: string }> {
  try {
    const client = asUntyped(getSupabaseServerClient());
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { success: false, error: 'Sign in to save links.' };

    const { data: account, error: fetchError } = await client
      .from('accounts')
      .select('public_data')
      .eq('id', user.id)
      .single();
    if (fetchError) {
      console.error('[CollectionLinks] Fetch account failed', fetchError);
      return { success: false, error: 'Could not load your account.' };
    }

    const cleaned = readCollectionLinks(links);
    const publicData = { ...((account?.public_data as Record<string, unknown> | null) ?? {}) };
    publicData.collection_links = cleaned.length > 0 ? cleaned : null;

    const { error } = await client.from('accounts').update({ public_data: publicData }).eq('id', user.id);
    if (error) {
      console.error('[CollectionLinks] Save failed', error);
      return { success: false, error: 'Could not save your links.' };
    }
    console.log('[CollectionLinks] Saved', { count: cleaned.length });
    return { success: true, links: cleaned };
  } catch (err) {
    console.error('[CollectionLinks] Save threw', err);
    return { success: false, error: 'Could not save your links.' };
  }
}
