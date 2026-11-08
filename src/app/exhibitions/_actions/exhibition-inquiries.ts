'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';
import { asUntyped } from '~/lib/supabase-untyped';

export interface ExhibitionInquiry {
  id: string;
  artwork_id: string;
  artwork_title: string | null;
  name: string;
  email: string;
  message: string | null;
  inquiry_type: 'inquire' | 'purchase';
  status: string;
  created_at: string;
}

/**
 * Inquiries and purchases made on creator sites (usually the artist's) for
 * works in this show, for the curator and their team. Only those made since
 * the show went public, so the artist's earlier leads stay theirs.
 */
export async function getExhibitionInquiries(exhibitionId: string): Promise<ExhibitionInquiry[]> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('gallery_id, published_at')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (!exhibition?.published_at) return [];
  if (!(await canManageExhibition(user.id, exhibition.gallery_id))) return [];

  const { data: links } = await admin
    .from('exhibition_artworks')
    .select('artwork_id, cos_artwork_id, status')
    .eq('exhibition_id', exhibitionId);
  const artworkIds = [
    ...new Set(
      ((links ?? []) as { artwork_id: string; cos_artwork_id: string | null; status: unknown }[])
        .filter((l) => isShownInExhibition(l.status))
        .flatMap((l) => [l.artwork_id, l.cos_artwork_id])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (artworkIds.length === 0) return [];

  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < artworkIds.length; i += 200) {
    const { data, error } = await admin
      .from('artwork_inquiries')
      .select('id, artwork_id, name, email, message, inquiry_type, status, created_at, artworks(title)')
      .in('artwork_id', artworkIds.slice(i, i + 200))
      .gte('created_at', exhibition.published_at)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      console.error('[ExhibitionInquiries] list failed', error);
      return [];
    }
    rows.push(...((data ?? []) as Record<string, unknown>[]));
  }

  return rows
    .map((r) => ({
      id: r.id as string,
      artwork_id: r.artwork_id as string,
      artwork_title: ((r.artworks ?? null) as { title?: string | null } | null)?.title ?? null,
      name: r.name as string,
      email: r.email as string,
      message: (r.message as string | null) ?? null,
      inquiry_type: r.inquiry_type as ExhibitionInquiry['inquiry_type'],
      status: r.status as string,
      created_at: r.created_at as string,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 200);
}
