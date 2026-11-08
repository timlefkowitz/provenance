'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { cleanArtworkIds, isValidListId, normalizeListName } from '~/lib/artwork-lists';
import type { ArtworkForPrintMenu } from '../edit-provenance/_components/print-menu';

export type ArtworkList = {
  id: string;
  name: string;
  item_count: number;
  updated_at: string;
};

export type ListArtwork = ArtworkForPrintMenu & {
  status: string | null;
  added_at: string;
};

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const LIST_ARTWORK_FIELDS = `id, title, artist_name, certificate_number, creation_date, medium, dimensions,
  edition, owned_by, description, image_url, former_owners, auction_history, exhibition_history,
  historic_context, value, value_is_public, status`;

async function getClientAndUser() {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  return { client, user };
}

async function touchList(client: ReturnType<typeof asUntyped>, listId: string) {
  await client.from('artwork_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId);
}

function revalidateLists(listId?: string) {
  revalidatePath('/artworks/lists');
  if (listId) revalidatePath(`/artworks/lists/${listId}`);
}

export async function listMyLists(): Promise<ArtworkList[]> {
  const { client, user } = await getClientAndUser();
  if (!user) return [];

  const { data, error } = await client
    .from('artwork_lists')
    .select('id, name, updated_at, artwork_list_items(count)')
    .eq('account_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[ArtworkLists] listMyLists failed', error);
    return [];
  }

  return (data ?? []).map(
    (row: { id: string; name: string; updated_at: string; artwork_list_items: { count: number }[] }) => ({
      id: row.id,
      name: row.name,
      updated_at: row.updated_at,
      item_count: row.artwork_list_items?.[0]?.count ?? 0,
    }),
  );
}

export async function createList(name: string): Promise<Result<ArtworkList>> {
  const cleaned = normalizeListName(name);
  if (!cleaned) return { success: false, error: 'List name is required' };

  const { client, user } = await getClientAndUser();
  if (!user) return { success: false, error: 'You must be signed in' };

  const { data, error } = await client
    .from('artwork_lists')
    .insert({ account_id: user.id, name: cleaned })
    .select('id, name, updated_at')
    .single();

  if (error) {
    // Unique violation: a list with this name already exists — return it.
    if (error.code === '23505') {
      const { data: existing } = await client
        .from('artwork_lists')
        .select('id, name, updated_at, artwork_list_items(count)')
        .eq('account_id', user.id)
        .ilike('name', cleaned.replace(/[%_\\]/g, '\\$&'))
        .maybeSingle();
      if (existing) {
        return {
          success: true,
          data: {
            id: existing.id,
            name: existing.name,
            updated_at: existing.updated_at,
            item_count: existing.artwork_list_items?.[0]?.count ?? 0,
          },
        };
      }
    }
    console.error('[ArtworkLists] createList failed', error);
    return { success: false, error: 'Could not create list' };
  }

  revalidateLists();
  return { success: true, data: { ...data, item_count: 0 } };
}

export async function renameList(listId: string, name: string): Promise<Result> {
  const cleaned = normalizeListName(name);
  if (!isValidListId(listId) || !cleaned) return { success: false, error: 'Invalid list name' };

  const { client, user } = await getClientAndUser();
  if (!user) return { success: false, error: 'You must be signed in' };

  const { error } = await client
    .from('artwork_lists')
    .update({ name: cleaned, updated_at: new Date().toISOString() })
    .eq('id', listId)
    .eq('account_id', user.id);

  if (error) {
    if (error.code === '23505') return { success: false, error: 'You already have a list with that name' };
    console.error('[ArtworkLists] renameList failed', error);
    return { success: false, error: 'Could not rename list' };
  }

  revalidateLists(listId);
  return { success: true, data: undefined };
}

export async function deleteList(listId: string): Promise<Result> {
  if (!isValidListId(listId)) return { success: false, error: 'Invalid list' };

  const { client, user } = await getClientAndUser();
  if (!user) return { success: false, error: 'You must be signed in' };

  const { error } = await client.from('artwork_lists').delete().eq('id', listId).eq('account_id', user.id);
  if (error) {
    console.error('[ArtworkLists] deleteList failed', error);
    return { success: false, error: 'Could not delete list' };
  }

  revalidateLists();
  return { success: true, data: undefined };
}

/** Adds artworks to a list. Re-adding a work already on the list is a no-op. */
export async function addToList(listId: string, artworkIds: string[]): Promise<Result<{ added: number }>> {
  const ids = cleanArtworkIds(artworkIds);
  if (!isValidListId(listId) || ids.length === 0) return { success: false, error: 'Nothing to add' };

  const { client, user } = await getClientAndUser();
  if (!user) return { success: false, error: 'You must be signed in' };

  // Only the owner's own artworks can go on a list (RLS enforces this too;
  // filtering first gives a clean count and avoids a whole-batch failure).
  const { data: owned, error: ownedError } = await client
    .from('artworks')
    .select('id')
    .in('id', ids)
    .eq('account_id', user.id);

  if (ownedError) {
    console.error('[ArtworkLists] addToList ownership check failed', ownedError);
    return { success: false, error: 'Could not add to list' };
  }

  const ownedIds = (owned ?? []).map((a: { id: string }) => a.id);
  if (ownedIds.length === 0) return { success: false, error: 'Only your own artworks can be added to a list' };

  const { error } = await client
    .from('artwork_list_items')
    .upsert(
      ownedIds.map((artworkId: string) => ({ list_id: listId, artwork_id: artworkId })),
      { onConflict: 'list_id,artwork_id', ignoreDuplicates: true },
    );

  if (error) {
    console.error('[ArtworkLists] addToList failed', error);
    return { success: false, error: 'Could not add to list' };
  }

  await touchList(client, listId);
  revalidateLists(listId);
  return { success: true, data: { added: ownedIds.length } };
}

export async function removeFromList(listId: string, artworkIds: string[]): Promise<Result> {
  const ids = cleanArtworkIds(artworkIds);
  if (!isValidListId(listId) || ids.length === 0) return { success: false, error: 'Nothing to remove' };

  const { client, user } = await getClientAndUser();
  if (!user) return { success: false, error: 'You must be signed in' };

  const { error } = await client.from('artwork_list_items').delete().eq('list_id', listId).in('artwork_id', ids);
  if (error) {
    console.error('[ArtworkLists] removeFromList failed', error);
    return { success: false, error: 'Could not remove from list' };
  }

  await touchList(client, listId);
  revalidateLists(listId);
  return { success: true, data: undefined };
}

export async function clearList(listId: string): Promise<Result> {
  if (!isValidListId(listId)) return { success: false, error: 'Invalid list' };

  const { client, user } = await getClientAndUser();
  if (!user) return { success: false, error: 'You must be signed in' };

  const { error } = await client.from('artwork_list_items').delete().eq('list_id', listId);
  if (error) {
    console.error('[ArtworkLists] clearList failed', error);
    return { success: false, error: 'Could not clear list' };
  }

  await touchList(client, listId);
  revalidateLists(listId);
  return { success: true, data: undefined };
}

/** Ids of the caller's lists that already contain this artwork. */
export async function getListIdsForArtwork(artworkId: string): Promise<string[]> {
  const [id] = cleanArtworkIds([artworkId]);
  if (!id) return [];

  const { client, user } = await getClientAndUser();
  if (!user) return [];

  const { data, error } = await client.from('artwork_list_items').select('list_id').eq('artwork_id', id);
  if (error) {
    console.error('[ArtworkLists] getListIdsForArtwork failed', error);
    return [];
  }
  return (data ?? []).map((row: { list_id: string }) => row.list_id);
}

export async function getListWithArtworks(
  listId: string,
): Promise<{ list: { id: string; name: string }; artworks: ListArtwork[] } | null> {
  if (!isValidListId(listId)) return null;

  const { client, user } = await getClientAndUser();
  if (!user) return null;

  const { data: list, error: listError } = await client
    .from('artwork_lists')
    .select('id, name')
    .eq('id', listId)
    .eq('account_id', user.id)
    .maybeSingle();

  if (listError || !list) {
    if (listError) console.error('[ArtworkLists] getListWithArtworks list failed', listError);
    return null;
  }

  const { data: items, error: itemsError } = await client
    .from('artwork_list_items')
    .select(`added_at, artworks(${LIST_ARTWORK_FIELDS})`)
    .eq('list_id', listId)
    .order('added_at', { ascending: true });

  if (itemsError) {
    console.error('[ArtworkLists] getListWithArtworks items failed', itemsError);
    return { list, artworks: [] };
  }

  type ItemRow = { added_at: string; artworks: ListArtwork | ListArtwork[] | null };
  const artworks: ListArtwork[] = ((items ?? []) as unknown as ItemRow[])
    .map((row) => {
      const artwork = Array.isArray(row.artworks) ? row.artworks[0] : row.artworks;
      return artwork ? { ...artwork, added_at: row.added_at } : null;
    })
    .filter((a): a is ListArtwork => a !== null);

  return { list, artworks };
}
