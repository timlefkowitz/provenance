import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import {
  computeExhibitionWorkScanStats,
  exhibitionScanWindow,
  type ExhibitionWorkScanStats,
  type ScanWindow,
} from '~/lib/exhibition-scan-stats';
import { asUntyped } from '~/lib/supabase-untyped';

import { isShownInExhibition } from './exhibition-submission-status';

export type ExhibitionScanWork = {
  /** The certificate shown in the exhibition (the artist's COA when there is one). */
  id: string;
  title: string;
  artistName: string | null;
  imageUrl: string | null;
  stats: ExhibitionWorkScanStats;
};

export type ExhibitionScans = {
  exhibition: { id: string; title: string; start_date: string | null; end_date: string | null };
  /** 'all': an organiser sees every work; 'artist': an artist sees their own works only. */
  scope: 'all' | 'artist';
  window: ScanWindow;
  works: ExhibitionScanWork[];
};

type Link = {
  artwork_id: string;
  status: unknown;
  cos_artwork_id: string | null;
  created_at: string | null;
};

type Row = {
  id: string;
  title: string | null;
  artist_name: string | null;
  image_url: string | null;
  account_id: string | null;
  artist_account_id: string | null;
  status: string | null;
  metadata: unknown;
};

/**
 * QR scan analytics for a show, or null when the viewer may not see them.
 *
 * Organisers of the show (the owning gallery, institution or curator and
 * their team) see every work; an artist sees the works they made or hold.
 * Each work's scans combine the certificate on the wall with the artist's COA
 * it was issued from, so a work counts the same whichever QR was printed.
 */
export async function getExhibitionScans(
  userId: string,
  exhibitionId: string,
): Promise<ExhibitionScans | null> {
  // Access is checked below; the service role reads certificates other people hold.
  const admin = asUntyped(getSupabaseServerAdminClient());

  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('id, title, gallery_id, start_date, end_date')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (!exhibition) return null;

  const organiser = await canManageExhibition(userId, exhibition.gallery_id as string);

  const { data: linkRows } = await admin
    .from('exhibition_artworks')
    .select('artwork_id, status, cos_artwork_id, created_at')
    .eq('exhibition_id', exhibitionId);
  const links = ((linkRows ?? []) as Link[]).filter((l) => isShownInExhibition(l.status));

  // One work per piece on the wall; the Certificate of Show issued for an
  // artist's COA in the show is folded into that COA.
  const certsOf = new Map<string, Set<string>>();
  const joinedAt = new Map<string, string | null>();
  const folded = links.filter((l) => l.cos_artwork_id && l.cos_artwork_id !== l.artwork_id);
  const foldedCosIds = new Set(folded.map((l) => l.cos_artwork_id as string));
  for (const l of links) {
    if (foldedCosIds.has(l.artwork_id)) continue;
    certsOf.set(l.artwork_id, new Set([l.artwork_id]));
    joinedAt.set(l.artwork_id, l.created_at);
  }
  for (const l of folded) {
    certsOf.get(l.artwork_id)?.add(l.cos_artwork_id as string);
  }

  const allIds = [...new Set([...certsOf.values()].flatMap((s) => [...s]))];
  const rows = new Map<string, Row>();
  for (let i = 0; i < allIds.length; i += 200) {
    const { data } = await admin
      .from('artworks')
      .select('id, title, artist_name, image_url, account_id, artist_account_id, status, metadata')
      .in('id', allIds.slice(i, i + 200));
    for (const r of (data ?? []) as Row[]) rows.set(r.id, r);
  }
  // If the COA itself can't be shown, the work is shown as its COS instead.
  const showable = (id: string) => {
    const r = rows.get(id);
    return !!r && (r.status === 'verified' || r.status === 'draft');
  };
  for (const l of folded) {
    const cos = l.cos_artwork_id as string;
    const certs = certsOf.get(l.artwork_id);
    if (!certs || showable(l.artwork_id) || !showable(cos)) continue;
    certsOf.delete(l.artwork_id);
    certsOf.set(cos, certs);
    joinedAt.set(cos, joinedAt.get(l.artwork_id) ?? null);
  }

  const isMine = (r: Row | undefined) =>
    !!r && (r.account_id === userId || r.artist_account_id === userId);

  const entries = [...certsOf.entries()].filter(([id, certs]) => {
    const shown = rows.get(id);
    if (!shown || (shown.status !== 'verified' && shown.status !== 'draft')) return false;
    return organiser || [...certs].some((c) => isMine(rows.get(c)));
  });
  if (!organiser && entries.length === 0) return null;

  const artistIds = [
    ...new Set(
      entries.flatMap(([, certs]) =>
        [...certs].map((c) => rows.get(c)?.artist_account_id).filter((v): v is string => !!v),
      ),
    ),
  ];
  const { data: accounts } = artistIds.length
    ? await admin.from('accounts').select('id, name').in('id', artistIds)
    : { data: [] };
  const accountName = new Map<string, string>(
    ((accounts ?? []) as { id: string; name: string | null }[]).map((a) => [a.id, a.name ?? '']),
  );

  const showWindow = exhibitionScanWindow({
    start_date: (exhibition.start_date as string | null) ?? null,
    end_date: (exhibition.end_date as string | null) ?? null,
  });

  const works: ExhibitionScanWork[] = entries.map(([id, certs]) => {
    const shown = rows.get(id) as Row;
    const certRows = [...certs].map((c) => rows.get(c)).filter((r): r is Row => !!r);
    const artistAccount = certRows.find((r) => r.artist_account_id)?.artist_account_id ?? null;
    const window = showWindow.from
      ? showWindow
      : exhibitionScanWindow({ start_date: null, end_date: showWindow.to }, joinedAt.get(id));
    return {
      id,
      title: shown.title || 'Untitled',
      artistName:
        certRows.map((r) => r.artist_name?.trim()).find(Boolean) ||
        (artistAccount ? accountName.get(artistAccount) || null : null),
      imageUrl: shown.image_url ?? certRows.find((r) => r.image_url)?.image_url ?? null,
      stats: computeExhibitionWorkScanStats(
        certRows.map((r) => r.metadata),
        window,
      ),
    };
  });

  works.sort(
    (a, b) =>
      b.stats.duringShow - a.stats.duringShow ||
      b.stats.allTime - a.stats.allTime ||
      a.title.localeCompare(b.title),
  );

  return {
    exhibition: {
      id: exhibition.id as string,
      title: exhibition.title as string,
      start_date: (exhibition.start_date as string | null) ?? null,
      end_date: (exhibition.end_date as string | null) ?? null,
    },
    scope: organiser ? 'all' : 'artist',
    window: showWindow,
    works,
  };
}

/**
 * Whether an artist (not an organiser) has a work in the show, and so gets a
 * link to its QR scans. Organisers are checked with canManageExhibition.
 */
export async function hasOwnWorkInExhibition(userId: string, exhibitionId: string) {
  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: linkRows } = await admin
    .from('exhibition_artworks')
    .select('artwork_id, status, cos_artwork_id')
    .eq('exhibition_id', exhibitionId);
  const ids = [
    ...new Set(
      ((linkRows ?? []) as Link[])
        .filter((l) => isShownInExhibition(l.status))
        .flatMap((l) => [l.artwork_id, l.cos_artwork_id].filter((v): v is string => !!v)),
    ),
  ];
  if (ids.length === 0) return false;
  for (let i = 0; i < ids.length; i += 200) {
    const { count } = await admin
      .from('artworks')
      .select('id', { count: 'exact', head: true })
      .in('id', ids.slice(i, i + 200))
      .or(`account_id.eq.${userId},artist_account_id.eq.${userId}`);
    if ((count ?? 0) > 0) return true;
  }
  return false;
}
