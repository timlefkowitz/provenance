'use server';

import { formatTombstone } from '~/lib/artist-details/fields';
import type { ArtistBio } from '../_helpers/artist-bios';
import { requireExhibitionManager } from '../_helpers/require-exhibition-manager';
import { loadExhibitionArtists } from '../_helpers/load-exhibition-artists';

export type ExhibitionArtistBio = Omit<ArtistBio, 'profile'> & {
  /** Bio from the profile, before the curator's show copy. */
  profileBio: string;
  artistStatement: string;
  tombstone: string;
  pictureUrl: string | null;
};

/**
 * Artist bios for an exhibition's wall labels and catalog, one entry per
 * artist in the show. Uses the curator's show copy where set, else the
 * artist's profile. Only people who can manage the exhibition may load them.
 */
export async function getExhibitionArtistBios(exhibitionId: string): Promise<ExhibitionArtistBio[]> {
  const auth = await requireExhibitionManager(exhibitionId);
  if (!auth.ok) throw new Error(auth.error);

  const artists = await loadExhibitionArtists(auth.ctx.admin, exhibitionId);
  console.log('[Exhibitions] getExhibitionArtistBios', { exhibitionId, artists: artists.length });
  return artists
    .filter((a) => a.artworkIds.length > 0)
    .map((a) => ({
      key: a.key,
      name: a.name,
      bio: a.effective.bio ?? '',
      profileBio: a.profileFields.bio ?? '',
      artworkIds: a.artworkIds,
      artistStatement: a.effective.artist_statement ?? '',
      tombstone: formatTombstone(a.effective),
      pictureUrl: a.effective.picture_url,
    }));
}
