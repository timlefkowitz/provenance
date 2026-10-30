import 'server-only';

import { after } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { logger } from '~/lib/logger';
import { asUntyped } from '~/lib/supabase-untyped';

import { refreshArtworkFingerprints } from './store';

/**
 * Computes reverse-image-lookup embeddings for artworks after the response is sent, so
 * uploads never wait on (or fail because of) the model. Call right after an artwork row's
 * image_url is inserted or changed. Anything missed is picked up by
 * scripts/backfill-artwork-fingerprints.ts.
 */
export function scheduleArtworkFingerprints(artworkIds: (string | null | undefined)[]): void {
  const ids = artworkIds.filter((id): id is string => Boolean(id));
  if (!ids.length) return;
  runAfterResponse(ids, async () => ids);
}

/**
 * Same, for every artwork linked to an exhibition (already up-to-date rows are skipped).
 * Lets bulk exhibition flows hook in with one call instead of threading ids through.
 */
export function scheduleExhibitionArtworkFingerprints(exhibitionId: string): void {
  if (!exhibitionId) return;
  runAfterResponse({ exhibitionId }, async (admin) => {
    const { data, error } = await admin
      .from('exhibition_artworks')
      .select('artwork_id')
      .eq('exhibition_id', exhibitionId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.artwork_id as string).filter(Boolean);
  });
}

function runAfterResponse(
  context: unknown,
  resolveIds: (admin: ReturnType<typeof asUntyped>) => Promise<string[]>,
): void {
  const run = async () => {
    try {
      const admin = asUntyped(getSupabaseServerAdminClient());
      const result = await refreshArtworkFingerprints(admin, await resolveIds(admin));
      if (result.failed.length) {
        logger.error('artwork_fingerprint_failed', { failed: result.failed });
      }
      console.log('[ImageFingerprint] refreshed', { ...result, failed: result.failed.length });
    } catch (error) {
      logger.error('artwork_fingerprint_refresh_error', { context, error });
    }
  };

  try {
    after(run);
  } catch {
    // Outside a request scope (e.g. a script) — run detached instead.
    void run();
  }
}
