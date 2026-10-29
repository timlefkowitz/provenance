import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';

import { loadAncestorIds } from './certificate-chain';

export interface CollectorExhibitionEntry {
  exhibition: {
    id: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
    location: string | null;
  };
  /** The collector's own artwork ids that were shown (via any certificate of the work). */
  artworkIds: string[];
}

/**
 * Published exhibitions that showed works the collector owns, including shows
 * that linked the artist's CoA or the gallery's CoS rather than their COO.
 */
export async function loadCollectorExhibitionHistory(
  ownedArtworkIds: string[],
): Promise<CollectorExhibitionEntry[]> {
  if (!ownedArtworkIds.length) return [];
  const admin = asUntyped(getSupabaseServerAdminClient());

  try {
    const ownerOf = await loadAncestorIds(admin, ownedArtworkIds);
    const chainIds = Array.from(ownerOf.keys());

    const { data: links, error: linkErr } = await admin
      .from('exhibition_artworks')
      .select('exhibition_id, artwork_id, status')
      .in('artwork_id', chainIds);
    if (linkErr) console.error('[Collectors] history links fetch failed', linkErr);

    const artworksByExhibition = new Map<string, Set<string>>();
    for (const link of (links ?? []) as Array<{ exhibition_id: string; artwork_id: string; status: string | null }>) {
      if (!isShownInExhibition(link.status)) continue;
      const owned = ownerOf.get(link.artwork_id);
      if (!owned) continue;
      if (!artworksByExhibition.has(link.exhibition_id)) artworksByExhibition.set(link.exhibition_id, new Set());
      artworksByExhibition.get(link.exhibition_id)!.add(owned);
    }
    if (!artworksByExhibition.size) return [];

    const { data: exhibitions, error: exErr } = await admin
      .from('exhibitions')
      .select('id, title, start_date, end_date, location')
      .in('id', Array.from(artworksByExhibition.keys()))
      .not('published_at', 'is', null)
      .order('start_date', { ascending: false, nullsFirst: false });
    if (exErr) console.error('[Collectors] history exhibitions fetch failed', exErr);

    return ((exhibitions ?? []) as CollectorExhibitionEntry['exhibition'][]).map((exhibition) => ({
      exhibition,
      artworkIds: Array.from(artworksByExhibition.get(exhibition.id) ?? []),
    }));
  } catch (err) {
    console.error('[Collectors] loadCollectorExhibitionHistory failed', err);
    return [];
  }
}
