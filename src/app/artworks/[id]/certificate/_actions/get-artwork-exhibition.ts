'use server';

import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { getUserRole, isTeamProfileRole, USER_ROLES } from '~/lib/user-roles';
import { resolveCuratorLink } from '~/app/exhibitions/_helpers/curator-profile';

export type ArtworkExhibition = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  /** Owner mode the show runs under; `artist` means a curator-run show. */
  owner_role?: string | null;
  /** Curator named on the show (exhibitions.metadata.curator), when set. */
  curator?: string | null;
  /** Profile page for the curator, when the name resolves to one. */
  curatorHref?: string | null;
  gallery?: {
    id: string;
    name: string;
    profileId?: string;
    slug?: string;
  } | null;
} | null;

export type ArtworkExhibitionEntry = NonNullable<ArtworkExhibition>;

/**
 * Get the most recent exhibition an artwork is linked to (used where only one
 * show fits, e.g. the edit form). Certificates should use getArtworkExhibitions.
 */
export async function getArtworkExhibition(artworkId: string): Promise<ArtworkExhibition> {
  const all = await getArtworkExhibitions(artworkId);
  return all[0] ?? null;
}

type ExhibitionRow = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  gallery_id: string | null;
  /** Venue profile the show is at; wins over the owner account's default profile. */
  gallery_profile_id: string | null;
  owner_role: string | null;
  metadata: Record<string, unknown> | null;
};

/**
 * Every exhibition an artwork has been selected for, newest first, each with
 * its gallery / institution, so a certificate can list the full show history.
 */
export async function getArtworkExhibitions(artworkId: string): Promise<ArtworkExhibitionEntry[]> {
  const client = asUntyped(getSupabaseServerClient());

  const { data: rows, error } = await client
    .from('exhibition_artworks')
    .select(`
      exhibition_id,
      exhibitions!exhibition_artworks_exhibition_id_fkey (
        id,
        title,
        start_date,
        end_date,
        location,
        gallery_id,
        gallery_profile_id,
        owner_role,
        metadata
      )
    `)
    .eq('artwork_id', artworkId)
    .eq('status', 'selected');

  if (error) {
    console.error('Error fetching artwork exhibitions:', error);
    return [];
  }

  // A to-one embed is an object at runtime; the inferred type is an array.
  const seen = new Set<string>();
  const exhibitions: ExhibitionRow[] = [];
  for (const row of (rows ?? []) as Array<{ exhibitions: ExhibitionRow | ExhibitionRow[] | null }>) {
    const ex = Array.isArray(row.exhibitions) ? row.exhibitions[0] : row.exhibitions;
    if (!ex || !ex.title || seen.has(ex.id)) continue;
    seen.add(ex.id);
    exhibitions.push(ex);
  }

  exhibitions.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));

  return Promise.all(exhibitions.map((ex) => withGallery(client, ex)));
}

async function withGallery(
  client: UntypedSupabaseClient,
  exhibition: ExhibitionRow,
): Promise<ArtworkExhibitionEntry> {
  let galleryInfo: { id: string; name: string; profileId?: string; slug?: string } | null = null;
  const curatorRaw = exhibition.metadata?.curator;
  const curator = typeof curatorRaw === 'string' && curatorRaw.trim() ? curatorRaw.trim() : null;

  // A show held at a specific gallery/institution profile names that venue.
  if (exhibition.gallery_profile_id) {
    const { data: venue } = await client
      .from('user_profiles')
      .select('id, name, slug, user_id')
      .eq('id', exhibition.gallery_profile_id)
      .maybeSingle();
    if (venue?.name) {
      galleryInfo = {
        id: (venue.user_id as string) ?? exhibition.gallery_id ?? '',
        name: venue.name as string,
        profileId: venue.id as string,
        slug: (venue.slug as string | null) || undefined,
      };
    }
  }

  // Otherwise fall back to the owner account's profile for its owner mode.
  if (!galleryInfo && exhibition.gallery_id) {
    try {
      // Get gallery account
      const { data: galleryAccount } = await client
        .from('accounts')
        .select('id, name, public_data')
        .eq('id', exhibition.gallery_id)
        .single();

      if (galleryAccount && exhibition.owner_role === USER_ROLES.ARTIST) {
        // Curator-run show: credit the curator, not the account's gallery profile.
        galleryInfo = {
          id: galleryAccount.id,
          name: curator || galleryAccount.name,
        };
      } else if (galleryAccount) {
        // The show's owner mode (gallery / institution) decides which profile to name;
        // fall back to the account's current role for older rows without owner_role.
        const accountRole = getUserRole(galleryAccount.public_data as Record<string, unknown>);
        const ownerRole = isTeamProfileRole(exhibition.owner_role)
          ? exhibition.owner_role
          : isTeamProfileRole(accountRole)
            ? accountRole
            : null;

        if (ownerRole) {
          // Try to get gallery / institution profile name (preferred)
          const galleryProfile = await getUserProfileByRole(galleryAccount.id, ownerRole);
          
          // If getUserProfileByRole doesn't return slug, fetch it directly
          let slug: string | undefined = undefined;
          if (galleryProfile?.id) {
            const { data: profileWithSlug } = await client
              .from('user_profiles')
              .select('slug')
              .eq('id', galleryProfile.id)
              .single();
            slug = profileWithSlug?.slug || undefined;
          }
          
          galleryInfo = {
            id: galleryAccount.id,
            name: galleryProfile?.name || galleryAccount.name,
            profileId: galleryProfile?.id,
            slug: slug,
          };
        } else {
          // Fallback to account name if not a gallery
          galleryInfo = {
            id: galleryAccount.id,
            name: galleryAccount.name,
          };
        }
      }
    } catch (galleryError) {
      console.error('Error fetching gallery information:', galleryError);
      // Continue without gallery info
    }
  }

  const curatorLink = await resolveCuratorLink(curator, exhibition.gallery_id);

  return {
    id: exhibition.id,
    title: exhibition.title,
    start_date: exhibition.start_date,
    end_date: exhibition.end_date,
    location: exhibition.location,
    owner_role: exhibition.owner_role,
    curator,
    curatorHref: curatorLink?.href ?? null,
    gallery: galleryInfo,
  };
}

