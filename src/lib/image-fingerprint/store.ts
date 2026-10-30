/**
 * Writes artwork image embeddings. Takes a service-role client so it works both inside the
 * app (see schedule.ts) and from scripts/backfill-artwork-fingerprints.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { embedImageUrl } from './embed';
import { IMAGE_EMBEDDING_MODEL, toPgVector } from './similarity';

type AdminClient = SupabaseClient;

export type FingerprintRefreshResult = {
  updated: number;
  removed: number;
  skipped: number;
  failed: { artworkId: string; error: string }[];
};

/**
 * (Re)computes embeddings for the given artworks from their current image_url.
 * Rows already computed from the same URL with the current model are skipped unless `force`.
 * Never throws for a single bad image; failures are reported in the result.
 */
export async function refreshArtworkFingerprints(
  admin: AdminClient,
  artworkIds: string[],
  { force = false }: { force?: boolean } = {},
): Promise<FingerprintRefreshResult> {
  const result: FingerprintRefreshResult = { updated: 0, removed: 0, skipped: 0, failed: [] };
  const ids = [...new Set(artworkIds.filter(Boolean))];
  if (!ids.length) return result;

  const [{ data: artworks, error: awErr }, { data: existing, error: exErr }] = await Promise.all([
    admin.from('artworks').select('id, image_url').in('id', ids),
    admin.from('artwork_image_embeddings').select('artwork_id, model, source_image_url').in('artwork_id', ids),
  ]);
  if (awErr) throw new Error(`Failed to load artworks: ${awErr.message}`);
  if (exErr) throw new Error(`Failed to load embeddings: ${exErr.message}`);

  const current = new Map((existing ?? []).map((r) => [r.artwork_id as string, r]));

  for (const artwork of artworks ?? []) {
    const id = artwork.id as string;
    const imageUrl = (artwork.image_url as string | null)?.trim() || null;
    const prev = current.get(id);

    if (!imageUrl) {
      if (prev) {
        await admin.from('artwork_image_embeddings').delete().eq('artwork_id', id);
        result.removed++;
      } else {
        result.skipped++;
      }
      continue;
    }

    if (!force && prev && prev.source_image_url === imageUrl && prev.model === IMAGE_EMBEDDING_MODEL) {
      result.skipped++;
      continue;
    }

    try {
      const embedding = await embedImageUrl(imageUrl);
      const { error } = await admin.from('artwork_image_embeddings').upsert({
        artwork_id: id,
        embedding: toPgVector(embedding),
        model: IMAGE_EMBEDDING_MODEL,
        source_image_url: imageUrl,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      result.updated++;
    } catch (err) {
      result.failed.push({ artworkId: id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return result;
}
