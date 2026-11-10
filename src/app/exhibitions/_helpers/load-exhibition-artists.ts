import 'server-only';

import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';
import {
  EMPTY_SCALARS,
  SCALAR_FIELDS,
  cvEntriesFromCvJson,
  normalizeScalar,
  sanitizeCvEntries,
  sanitizePress,
  type ArtistDetailFields,
  type ArtistDetailScalars,
  type ScalarField,
} from '~/lib/artist-details/fields';
import type { ArtistCvJson } from '~/lib/grants';
import type { NewsPublicationInput } from '~/lib/news-publications';
import { isShownInExhibition } from './exhibition-submission-status';
import { resolveArtistBios, type ArtistBio, type ArtistBioArtworkRow, type ArtistBioProfile } from './artist-bios';

/**
 * How the curator can pass changes on to the artist:
 * - claimed: the artist has an account, so changes go as a suggestion
 * - placeholder: an unclaimed profile this curator's gallery may update directly
 * - placeholder_other: an unclaimed profile someone else created (read only)
 * - name_only: just a typed name on the works, no profile
 */
export type ArtistProfileLink = 'claimed' | 'placeholder' | 'placeholder_other' | 'name_only';

export type ShowCopyRow = Partial<ArtistDetailScalars> & {
  id: string;
  exhibition_id: string;
  artist_key: string;
  artist_profile_id: string | null;
  artist_account_id: string | null;
  display_name: string | null;
  cv_entries: unknown;
  press: unknown;
  updated_at: string;
};

export type ExhibitionArtist = {
  key: string;
  name: string;
  artworkIds: string[];
  profileId: string | null;
  accountId: string | null;
  link: ArtistProfileLink;
  /** What the artist's profile says now (empty for name-only artists). */
  profileFields: ArtistDetailFields;
  /** The curator's saved copy for this show, if any. */
  show: ArtistDetailFields | null;
  /** Show copy where set, else profile. Used by labels, catalog, public page. */
  effective: ArtistDetailFields;
  medium: string | null;
  location: string | null;
  profile: ArtistBioProfile | null;
};

export function profileToFields(p: ArtistBioProfile | undefined | null): ArtistDetailFields {
  if (!p) return { ...EMPTY_SCALARS, cv_entries: [], press: [] };
  const scalars = { ...EMPTY_SCALARS } as Record<ScalarField, unknown>;
  for (const f of SCALAR_FIELDS) scalars[f] = normalizeScalar(f, (p as Record<string, unknown>)[f]);
  return {
    ...(scalars as ArtistDetailScalars),
    cv_entries: cvEntriesFromCvJson(profileCvJson(p)),
    press: sanitizePress(p.news_publications),
  };
}

export function showRowToFields(row: ShowCopyRow): ArtistDetailFields {
  const scalars = { ...EMPTY_SCALARS } as Record<ScalarField, unknown>;
  for (const f of SCALAR_FIELDS) scalars[f] = normalizeScalar(f, row[f]);
  return {
    ...(scalars as ArtistDetailScalars),
    cv_entries: sanitizeCvEntries(row.cv_entries),
    press: sanitizePress(row.press),
  };
}

export function mergeEffective(profile: ArtistDetailFields, show: ArtistDetailFields | null): ArtistDetailFields {
  if (!show) return profile;
  const out = { ...profile } as Record<string, unknown>;
  for (const f of SCALAR_FIELDS) {
    if (show[f] !== null && show[f] !== undefined) out[f] = show[f];
  }
  out.cv_entries = show.cv_entries.length ? show.cv_entries : profile.cv_entries;
  out.press = show.press.length ? show.press : profile.press;
  return out as ArtistDetailFields;
}

/** Works shown in the exhibition, as rows for resolveArtistBios. */
async function loadShownArtworkRows(admin: UntypedSupabaseClient, exhibitionId: string): Promise<ArtistBioArtworkRow[]> {
  const { data: links, error: linksError } = await admin
    .from('exhibition_artworks')
    .select('artwork_id, status')
    .eq('exhibition_id', exhibitionId);
  if (linksError) {
    console.error('[ExhibitionArtists] links fetch failed', linksError);
    throw new Error('Could not load the artists in this exhibition.');
  }
  const artworkIds = (links || [])
    .filter((l: { status?: string }) => isShownInExhibition(l.status))
    .map((l: { artwork_id: string }) => l.artwork_id)
    .filter(Boolean);
  if (artworkIds.length === 0) return [];
  const { data, error } = await admin
    .from('artworks')
    .select('id, artist_name, artist_account_id, artist_profile_id')
    .in('id', artworkIds);
  if (error) {
    console.error('[ExhibitionArtists] artworks fetch failed', error);
    throw new Error('Could not load the artists in this exhibition.');
  }
  return (data || []) as ArtistBioArtworkRow[];
}

/**
 * Every artist in a show (from its shown works plus directly credited
 * artists), with profile fields, the curator's show copy and the merged view.
 * Server only; callers check access first.
 */
export async function loadExhibitionArtists(
  admin: UntypedSupabaseClient,
  exhibitionId: string,
  options: { canManageGallery?: (galleryAccountId: string) => Promise<boolean> } = {},
): Promise<ExhibitionArtist[]> {
  const rows = await loadShownArtworkRows(admin, exhibitionId);

  // Credited artists with no works yet still get a card. Their id is blank so
  // they add no artwork ids.
  const { data: credited } = await admin
    .from('exhibition_artists')
    .select('artist_account_id')
    .eq('exhibition_id', exhibitionId);
  const accountsWithWorks = new Set(rows.map((r) => r.artist_account_id).filter(Boolean));
  for (const c of (credited || []) as { artist_account_id: string | null }[]) {
    if (c.artist_account_id && !accountsWithWorks.has(c.artist_account_id)) {
      rows.push({ id: '', artist_name: null, artist_account_id: c.artist_account_id, artist_profile_id: null });
    }
  }

  const bios: ArtistBio[] = await resolveArtistBios(admin, rows, '[ExhibitionArtists]');

  const { data: showRows, error: showError } = await admin
    .from('exhibition_artist_details')
    .select('*')
    .eq('exhibition_id', exhibitionId);
  if (showError) console.error('[ExhibitionArtists] show copy fetch failed', showError);
  const showByKey = new Map<string, ShowCopyRow>();
  for (const r of (showRows || []) as ShowCopyRow[]) showByKey.set(r.artist_key, r);

  const placeholderAccess = new Map<string, boolean>();
  const out: ExhibitionArtist[] = [];
  for (const b of bios) {
    const p = b.profile ?? null;
    let link: ArtistProfileLink = 'name_only';
    if (p?.user_id) link = 'claimed';
    else if (p) {
      const creator = p.created_by_gallery_id;
      let ok = false;
      if (creator && options.canManageGallery) {
        if (!placeholderAccess.has(creator)) placeholderAccess.set(creator, await options.canManageGallery(creator));
        ok = placeholderAccess.get(creator) === true;
      }
      link = ok ? 'placeholder' : 'placeholder_other';
    }
    const profileFields = profileToFields(p);
    const showRow = showByKey.get(b.key);
    const show = showRow ? showRowToFields(showRow) : null;
    const accountId = b.key.startsWith('account:') ? b.key.slice('account:'.length) : p?.user_id ?? null;
    out.push({
      key: b.key,
      name: showRow?.display_name?.trim() || b.name,
      artworkIds: b.artworkIds,
      profileId: p?.id ?? null,
      accountId,
      link,
      profileFields,
      show,
      effective: mergeEffective(profileFields, show),
      medium: p?.medium ?? null,
      location: p?.location ?? null,
      profile: p,
    });
  }
  return out;
}

export type ProfileSnapshotSource = Pick<ArtistBioProfile, 'artist_cv_json' | 'news_publications'>;

export function profileCvJson(p: ProfileSnapshotSource | null | undefined): ArtistCvJson | null {
  const v = p?.artist_cv_json;
  return v && typeof v === 'object' ? (v as ArtistCvJson) : null;
}

export function profilePress(p: ProfileSnapshotSource | null | undefined): NewsPublicationInput[] {
  return sanitizePress(p?.news_publications);
}
