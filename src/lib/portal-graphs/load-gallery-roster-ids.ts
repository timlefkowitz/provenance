import { isShownInExhibition } from '~/app/exhibitions/_helpers/exhibition-submission-status';

/**
 * Resolve the artwork ids that make up a gallery's roster:
 *  1. Artworks tagged with one of the gallery's profile ids (CoS, COO, etc.)
 *  2. Artworks selected into exhibitions run by the gallery's owner account —
 *     these often carry no gallery_profile_id (artist CoAs added directly,
 *     or a CoS issued before the gallery profile could be resolved).
 *
 * An artist CoA is dropped when its Certificate of Show is already on the
 * roster, so a work is never counted twice.
 */
export async function loadGalleryRosterIds(
  admin: any,
  galleryProfileIds: string[],
): Promise<string[]> {
  if (!galleryProfileIds.length) return [];

  const ids = new Set<string>();

  const { data: tagged, error: taggedErr } = await admin
    .from('artworks')
    .select('id')
    .in('gallery_profile_id', galleryProfileIds);
  if (taggedErr) console.error('[PortalGraphs] loadGalleryRosterIds tagged fetch failed', taggedErr);
  for (const row of (tagged ?? []) as Array<{ id: string }>) ids.add(row.id);

  const { data: profiles, error: profilesErr } = await admin
    .from('user_profiles')
    .select('user_id')
    .in('id', galleryProfileIds);
  if (profilesErr) console.error('[PortalGraphs] loadGalleryRosterIds profile fetch failed', profilesErr);
  const ownerIds = Array.from(
    new Set(
      ((profiles ?? []) as Array<{ user_id: string | null }>)
        .map((p) => p.user_id)
        .filter((id): id is string => typeof id === 'string'),
    ),
  );

  if (ownerIds.length > 0) {
    const { data: exhibitions, error: exErr } = await admin
      .from('exhibitions')
      .select('id')
      .in('gallery_id', ownerIds);
    if (exErr) console.error('[PortalGraphs] loadGalleryRosterIds exhibition fetch failed', exErr);
    const exhibitionIds = ((exhibitions ?? []) as Array<{ id: string }>).map((e) => e.id);

    if (exhibitionIds.length > 0) {
      const { data: links, error: linkErr } = await admin
        .from('exhibition_artworks')
        .select('artwork_id, status, cos_artwork_id')
        .in('exhibition_id', exhibitionIds);
      if (linkErr) console.error('[PortalGraphs] loadGalleryRosterIds link fetch failed', linkErr);

      for (const link of (links ?? []) as Array<{
        artwork_id: string;
        status: string | null;
        cos_artwork_id: string | null;
      }>) {
        if (!isShownInExhibition(link.status)) continue;
        // The CoS is linked to the exhibition as its own row; skip the artist CoA.
        if (link.cos_artwork_id) {
          ids.add(link.cos_artwork_id);
          continue;
        }
        ids.add(link.artwork_id);
      }
    }
  }

  if (ids.size === 0) return [];

  // Drop artist CoAs whose Certificate of Show is already on the roster.
  const { data: sources, error: sourceErr } = await admin
    .from('artworks')
    .select('source_artwork_id')
    .in('id', Array.from(ids))
    .not('source_artwork_id', 'is', null);
  if (sourceErr) console.error('[PortalGraphs] loadGalleryRosterIds source fetch failed', sourceErr);
  for (const row of (sources ?? []) as Array<{ source_artwork_id: string }>) {
    ids.delete(row.source_artwork_id);
  }

  return Array.from(ids);
}
