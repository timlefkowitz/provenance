'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

export type QuickExhibitionListingInput = {
  title: string;
  price?: string;
  dimensions?: string;
};

/**
 * Creates draft artwork rows owned by the exhibition host and links them to the exhibition.
 * Visible on the exhibition page to the owner while status is draft; public sees them after verification.
 */
export async function createQuickExhibitionListings(
  exhibitionId: string,
  items: QuickExhibitionListingInput[],
) {
  console.log('[Exhibitions] createQuickExhibitionListings started', {
    exhibitionId,
    count: items?.length ?? 0,
  });

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.error('[Exhibitions] createQuickExhibitionListings: not authenticated');
    return { success: false as const, error: 'You must be signed in.' };
  }

  const { data: exhibition, error: exErr } = await (client as any)
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .single();

  if (exErr || !exhibition || exhibition.gallery_id !== user.id) {
    console.error('[Exhibitions] createQuickExhibitionListings: exhibition access denied', exErr);
    return { success: false as const, error: 'Exhibition not found or access denied.' };
  }

  const cleaned = items
    .map((i) => ({
      title: (i.title ?? '').trim(),
      price: (i.price ?? '').trim() || null,
      dimensions: (i.dimensions ?? '').trim().slice(0, 100) || null,
    }))
    .filter((i) => i.title.length > 0);

  if (cleaned.length === 0) {
    return { success: false as const, error: 'Add at least one artwork with a title.' };
  }

  const { data: accountRow } = await client.from('accounts').select('id').eq('id', user.id).maybeSingle();
  if (!accountRow) {
    const { error: acErr } = await client.from('accounts').insert({
      id: user.id,
      name: 'User',
      email: null,
    });
    if (acErr) {
      console.error('[Exhibitions] createQuickExhibitionListings: could not ensure account', acErr);
      return { success: false as const, error: 'Account setup required. Complete your profile first.' };
    }
  }

  let created = 0;
  for (const row of cleaned) {
    const metadata: Record<string, unknown> = {};
    if (row.price) metadata.exhibition_list_price = row.price;

    const { data: inserted, error: insErr } = await (client as any)
      .from('artworks')
      .insert({
        account_id: user.id,
        title: row.title,
        dimensions: row.dimensions,
        description: null,
        status: 'draft',
        metadata: Object.keys(metadata).length ? metadata : {},
      })
      .select('id')
      .single();

    if (insErr || !inserted?.id) {
      console.error('[Exhibitions] createQuickExhibitionListings: artwork insert failed', insErr);
      continue;
    }

    const { error: linkErr } = await (client as any).from('exhibition_artworks').insert({
      exhibition_id: exhibitionId,
      artwork_id: inserted.id,
    });

    if (linkErr) {
      if (linkErr.code !== '23505') {
        console.error('[Exhibitions] createQuickExhibitionListings: link failed', linkErr);
      }
      continue;
    }

    created += 1;
  }

  if (created === 0) {
    return { success: false as const, error: 'Could not save listings. Try again.' };
  }

  console.log('[Exhibitions] createQuickExhibitionListings success', { created });
  revalidatePath('/exhibitions');
  revalidatePath(`/exhibitions/${exhibitionId}`);

  return { success: true as const, created };
}
