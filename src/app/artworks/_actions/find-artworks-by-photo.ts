'use server';

import { headers } from 'next/headers';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { embedImage } from '~/lib/image-fingerprint/embed';
import { type MatchConfidence, rankMatches, toPgVector } from '~/lib/image-fingerprint/similarity';
import { logger } from '~/lib/logger';
import { checkRateLimit } from '~/lib/rate-limit';
import { asUntyped } from '~/lib/supabase-untyped';

const MAX_QUERY_BYTES = 12 * 1024 * 1024;
const MAX_RESULTS = 8;

export type PhotoMatch = {
  artworkId: string;
  title: string;
  artistName: string | null;
  imageUrl: string | null;
  certificateNumber: string | null;
  status: string | null;
  /** True when the signed-in viewer owns this artwork (can add it to their lists, edit it). */
  isOwner: boolean;
  similarity: number;
  confidence: MatchConfidence;
  score: number;
};

export type FindArtworksByPhotoResult =
  | { success: true; matches: PhotoMatch[] }
  | { success: false; error: string };

/**
 * Reverse image lookup: embeds the uploaded photo and returns the closest artworks.
 * Runs `match_artworks_by_image` with the caller's own Supabase client, so artworks RLS
 * applies — signed-out users only see public works, owners also see their drafts/private ones.
 *
 * FormData: `image` (File), optional `exhibitionId` to search only that exhibition's works.
 */
export async function findArtworksByPhoto(formData: FormData): Promise<FindArtworksByPhotoResult> {
  const image = formData.get('image');
  const exhibitionId = (formData.get('exhibitionId') as string | null)?.trim() || null;

  if (!(image instanceof File) || image.size === 0) {
    return { success: false, error: 'Choose or take a photo first.' };
  }
  if (image.size > MAX_QUERY_BYTES) {
    return { success: false, error: 'That photo is too large. Try a smaller one.' };
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  const allowed = await checkRateLimit(
    { headers: await headers() },
    {
      keyPrefix: user ? `photo-lookup:${user.id}` : 'photo-lookup',
      maxPerWindow: 30,
      windowMs: 60_000,
    },
  );
  if (!allowed) {
    return { success: false, error: 'Too many lookups. Wait a minute and try again.' };
  }

  let embedding: number[];
  try {
    embedding = await embedImage(Buffer.from(await image.arrayBuffer()));
  } catch (error) {
    logger.error('photo_lookup_embed_failed', { userId: user?.id, type: image.type, size: image.size, error });
    return { success: false, error: "Couldn't read that photo. Try a JPEG or PNG." };
  }

  const db = asUntyped(client);
  const { data: hits, error: rpcError } = await db.rpc('match_artworks_by_image', {
    query_embedding: toPgVector(embedding),
    match_count: MAX_RESULTS + 1, // +1 so the top hit can be compared with its runner-up
    filter_exhibition_id: exhibitionId,
  });
  if (rpcError) {
    logger.error('photo_lookup_rpc_failed', { userId: user?.id, exhibitionId, error: rpcError });
    return { success: false, error: 'Photo search is unavailable right now.' };
  }

  const ranked = rankMatches(
    ((hits ?? []) as { artwork_id: string; similarity: number }[]).map((h) => ({
      artworkId: h.artwork_id,
      similarity: Number(h.similarity),
    })),
    { limit: MAX_RESULTS },
  );
  if (!ranked.length) return { success: true, matches: [] };

  const { data: artworks } = await db
    .from('artworks')
    .select('id, title, artist_name, image_url, certificate_number, status, account_id')
    .in(
      'id',
      ranked.map((r) => r.artworkId),
    );
  const byId = new Map((artworks ?? []).map((a) => [a.id as string, a]));

  const matches: PhotoMatch[] = ranked.flatMap((r) => {
    const a = byId.get(r.artworkId);
    if (!a) return [];
    return [
      {
        ...r,
        title: (a.title as string) || 'Untitled',
        artistName: (a.artist_name as string | null) ?? null,
        imageUrl: (a.image_url as string | null) ?? null,
        certificateNumber: (a.certificate_number as string | null) ?? null,
        status: (a.status as string | null) ?? null,
        isOwner: !!user && a.account_id === user.id,
      },
    ];
  });

  console.log('[PhotoLookup] done', {
    userId: user?.id ?? null,
    exhibitionId,
    top: matches[0] ? { id: matches[0].artworkId, similarity: matches[0].similarity.toFixed(3) } : null,
    count: matches.length,
  });

  return { success: true, matches };
}
