import 'server-only';

import { headers } from 'next/headers';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { scheduleArtworkFingerprints } from '~/lib/image-fingerprint/schedule';
import { IMAGE_EMBEDDING_MODEL, parsePgVector } from '~/lib/image-fingerprint/similarity';
import { scanWall, type WallPlacement } from '~/lib/image-fingerprint/wall-scan';
import { logger } from '~/lib/logger';
import { checkRateLimit } from '~/lib/rate-limit';
import { asUntyped } from '~/lib/supabase-untyped';

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

/**
 * How long the scan may embed windows before it returns its best matches so far. The route
 * that calls this (api/exhibitions/wall-scan) allows 120 s; the rest covers a cold start
 * (model download + session) and the response.
 */
const SCAN_BUDGET_MS = 75_000;

export type ScanExhibitionWallResult =
  | {
      success: true;
      /** Left to right. Includes weak hits, which the dialog leaves unticked. */
      placements: WallPlacement[];
      /** Photo size in pixels (after EXIF rotation); boxes are fractions of it. */
      width: number;
      height: number;
      /** Works in the show with no image fingerprint yet, so they can't be recognised. */
      unindexedCount: number;
    }
  | { success: false; error: string };

/**
 * Wall scan: which of this exhibition's works hang in one photo of a wall, and in what order.
 *
 * FormData: `image` (File), `exhibitionId`, and `artworkIds` (JSON array) — the works the
 * caller is printing, so duplicates hidden on the page (see prefer-artist-coa) never match.
 * Ids are intersected with the exhibition's own works, and embeddings are read with the
 * caller's client, so RLS decides what can be matched.
 *
 * Not a server action on purpose: a server action gets the page's time limit (60 s on the
 * exhibition page), and a wall scan on a function's CPU can need more than that. It's called
 * from the api/exhibitions/wall-scan route, which has its own limit.
 */
export async function scanExhibitionWall(formData: FormData): Promise<ScanExhibitionWallResult> {
  const image = formData.get('image');
  const exhibitionId = String(formData.get('exhibitionId') ?? '').trim();
  let requestedIds: string[] = [];
  try {
    const parsed: unknown = JSON.parse(String(formData.get('artworkIds') ?? '[]'));
    if (Array.isArray(parsed)) requestedIds = parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    // fall back to every work in the show
  }

  if (!exhibitionId) return { success: false, error: 'Missing exhibition.' };
  if (!(image instanceof File) || image.size === 0) return { success: false, error: 'Choose or take a photo first.' };
  if (image.size > MAX_PHOTO_BYTES) return { success: false, error: 'That photo is too large. Try a smaller one.' };

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { success: false, error: 'Sign in to scan a wall.' };

  const allowed = await checkRateLimit(
    { headers: await headers() },
    { keyPrefix: `wall-scan:${user.id}`, maxPerWindow: 8, windowMs: 60_000 },
  );
  if (!allowed) return { success: false, error: 'Too many scans. Wait a minute and try again.' };

  const db = asUntyped(client);
  const { data: links, error: linkError } = await db
    .from('exhibition_artworks')
    .select('artwork_id')
    .eq('exhibition_id', exhibitionId);
  if (linkError) {
    logger.error('wall_scan_links_failed', { userId: user.id, exhibitionId, error: linkError });
    return { success: false, error: 'Couldn’t load this exhibition’s works.' };
  }
  const inShow = new Set((links ?? []).map((l) => l.artwork_id as string));
  const candidateIds = (requestedIds.length ? requestedIds : [...inShow]).filter((id) => inShow.has(id));
  if (!candidateIds.length) return { success: false, error: 'This exhibition has no works to look for.' };

  const { data: rows, error: embError } = await db
    .from('artwork_image_embeddings')
    .select('artwork_id, embedding, model')
    .in('artwork_id', candidateIds);
  if (embError) {
    logger.error('wall_scan_embeddings_failed', { userId: user.id, exhibitionId, error: embError });
    return { success: false, error: 'Photo matching is unavailable right now.' };
  }
  const references = (rows ?? [])
    .filter((r) => r.model === IMAGE_EMBEDDING_MODEL)
    .map((r) => ({ artworkId: r.artwork_id as string, embedding: parsePgVector(r.embedding as string) }));

  // Works without a current fingerprint can't be found; queue them so the next scan can.
  const indexed = new Set(references.map((r) => r.artworkId));
  const missing = candidateIds.filter((id) => !indexed.has(id));
  if (missing.length) scheduleArtworkFingerprints(missing);
  if (!references.length) {
    return {
      success: false,
      error: 'None of these works can be recognised yet. Make sure they have photos, then try again in a few minutes.',
    };
  }

  const started = Date.now();
  try {
    const result = await scanWall(Buffer.from(await image.arrayBuffer()), references, {
      deadline: started + SCAN_BUDGET_MS,
    });
    console.log('[WallScan] done', {
      userId: user.id,
      exhibitionId,
      candidates: references.length,
      unindexed: missing.length,
      found: result.placements.length,
      confidences: result.placements.map((p) => p.confidence),
      windows: result.windowsScanned,
      truncated: result.truncated,
      ms: Date.now() - started,
    });
    return {
      success: true,
      placements: result.placements,
      width: result.width,
      height: result.height,
      unindexedCount: missing.length,
    };
  } catch (error) {
    logger.error('wall_scan_failed', { userId: user.id, exhibitionId, type: image.type, size: image.size, error });
    return { success: false, error: "Couldn't read that photo. Try a JPEG or PNG." };
  }
}
