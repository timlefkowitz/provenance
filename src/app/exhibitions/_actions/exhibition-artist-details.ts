'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { assertAllowedFileWithAv } from '~/lib/file-signature';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';
import {
  SCALAR_FIELDS,
  formatTombstone,
  normalizeScalar,
  sanitizeCvEntries,
  sanitizePress,
  type ArtistDetailFields,
  type ScalarField,
} from '~/lib/artist-details/fields';
import { requireExhibitionManager } from '../_helpers/require-exhibition-manager';
import { loadExhibitionArtists, type ArtistProfileLink } from '../_helpers/load-exhibition-artists';

export type CuratorExhibitionArtist = {
  key: string;
  name: string;
  artworkCount: number;
  profileId: string | null;
  link: ArtistProfileLink;
  profileFields: ArtistDetailFields;
  show: ArtistDetailFields | null;
  effective: ArtistDetailFields;
  tombstone: string;
  medium: string | null;
  location: string | null;
  pendingSuggestion: boolean;
  suggestedFindings: number;
};

/**
 * Every artist in the show with their profile, the curator's show copy and
 * the merged result. Managers only.
 */
export async function getExhibitionArtistDetails(
  exhibitionId: string,
): Promise<{ success: true; artists: CuratorExhibitionArtist[] } | { success: false; error: string }> {
  const auth = await requireExhibitionManager(exhibitionId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { admin, userId } = auth.ctx;

  try {
    const artists = await loadExhibitionArtists(admin, exhibitionId, {
      canManageGallery: (galleryAccountId) => canManageExhibition(userId, galleryAccountId),
    });

    const profileIds = artists.map((a) => a.profileId).filter(Boolean) as string[];
    const pending = new Set<string>();
    if (profileIds.length) {
      const { data } = await admin
        .from('artist_profile_suggestions')
        .select('profile_id')
        .eq('status', 'pending')
        .eq('exhibition_id', exhibitionId)
        .in('profile_id', profileIds);
      for (const r of (data || []) as { profile_id: string }[]) pending.add(r.profile_id);
    }
    const findingCounts = new Map<string, number>();
    const { data: findings } = await admin
      .from('artist_research_findings')
      .select('artist_key')
      .eq('exhibition_id', exhibitionId)
      .eq('status', 'suggested');
    for (const f of (findings || []) as { artist_key: string }[]) {
      findingCounts.set(f.artist_key, (findingCounts.get(f.artist_key) ?? 0) + 1);
    }

    return {
      success: true,
      artists: artists.map((a) => ({
        key: a.key,
        name: a.name,
        artworkCount: a.artworkIds.length,
        profileId: a.profileId,
        link: a.link,
        profileFields: a.profileFields,
        show: a.show,
        effective: a.effective,
        tombstone: formatTombstone(a.effective),
        medium: a.medium,
        location: a.location,
        pendingSuggestion: a.profileId ? pending.has(a.profileId) : false,
        suggestedFindings: findingCounts.get(a.key) ?? 0,
      })),
    };
  } catch (e) {
    console.error('[ExhibitionArtists] getExhibitionArtistDetails failed', e);
    return { success: false, error: (e as Error).message || 'Could not load the artists.' };
  }
}

export type SaveExhibitionArtistInput = {
  exhibitionId: string;
  artistKey: string;
  /** Scalars: a value saves it, null clears it back to the profile. */
  fields: Partial<Record<ScalarField, unknown>> & {
    cv_entries?: unknown;
    press?: unknown;
  };
};

/** Save (upsert) the curator's copy of one artist for this show. */
export async function saveExhibitionArtistDetails(
  input: SaveExhibitionArtistInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireExhibitionManager(input.exhibitionId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { admin, userId } = auth.ctx;

  try {
    const artists = await loadExhibitionArtists(admin, input.exhibitionId);
    const artist = artists.find((a) => a.key === input.artistKey);
    if (!artist) return { success: false, error: 'That artist is not in this exhibition.' };

    const row: Record<string, unknown> = {
      exhibition_id: input.exhibitionId,
      artist_key: input.artistKey,
      artist_profile_id: artist.profileId,
      artist_account_id: artist.accountId,
      display_name: artist.name,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    for (const f of SCALAR_FIELDS) {
      if (f in input.fields) row[f] = normalizeScalar(f, input.fields[f]);
    }
    if ('cv_entries' in input.fields) row.cv_entries = sanitizeCvEntries(input.fields.cv_entries);
    if ('press' in input.fields) row.press = sanitizePress(input.fields.press);

    if (
      containsObjectionableText(
        row.bio as string | null,
        row.artist_statement as string | null,
        row.birth_place as string | null,
        row.nationality as string | null,
      )
    ) {
      return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };
    }

    const { error } = await admin
      .from('exhibition_artist_details')
      .upsert(row, { onConflict: 'exhibition_id,artist_key' });
    if (error) {
      console.error('[ExhibitionArtists] save failed', error);
      return { success: false, error: 'Could not save the artist details.' };
    }
    console.log('[ExhibitionArtists] saved show copy', {
      exhibitionId: input.exhibitionId,
      artistKey: input.artistKey,
      fields: Object.keys(input.fields),
    });
    revalidatePath(`/exhibitions/${input.exhibitionId}/curate`);
    revalidatePath(`/exhibitions/${input.exhibitionId}`);
    return { success: true };
  } catch (e) {
    console.error('[ExhibitionArtists] saveExhibitionArtistDetails failed', e);
    return { success: false, error: (e as Error).message || 'Could not save the artist details.' };
  }
}

const PROFILES_BUCKET = 'profiles';

/** Upload an artist photo for the show copy. Returns its public URL. */
export async function uploadExhibitionArtistPhoto(
  formData: FormData,
): Promise<{ url: string | null; error: string | null }> {
  const exhibitionId = String(formData.get('exhibitionId') ?? '');
  const auth = await requireExhibitionManager(exhibitionId);
  if (!auth.ok) return { url: null, error: auth.error };

  const file = formData.get('file');
  if (!(file instanceof File)) return { url: null, error: 'No file provided' };
  if (!file.type.startsWith('image/')) return { url: null, error: 'File must be an image' };
  if (file.size > 5 * 1024 * 1024) return { url: null, error: 'Image size must be less than 5MB' };
  const check = await assertAllowedFileWithAv(file, 'image');
  if (!check.ok) return { url: null, error: check.error };

  // Admin client: the storage policy only lets users write under their own
  // user id, and this photo belongs to the exhibition.
  const bucket = asUntyped(getSupabaseServerAdminClient()).storage.from(PROFILES_BUCKET);
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
  const path = `exhibitions/${exhibitionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await bucket.upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) {
    console.error('[ExhibitionArtists] photo upload failed', error);
    return { url: null, error: 'Upload failed. Try again.' };
  }
  const { data } = bucket.getPublicUrl(path);
  return { url: data?.publicUrl ?? null, error: data?.publicUrl ? null : 'Could not get the photo URL.' };
}

export type PublicExhibitionArtist = {
  key: string;
  profileId: string | null;
  accountId: string | null;
  name: string;
  picture_url: string | null;
  tombstone: string;
  bio: string | null;
  artist_statement: string | null;
  website: string | null;
};

/**
 * Artist details for the public exhibition page: show copy over profile.
 * Published shows only, unless the viewer manages it.
 */
export async function getPublicExhibitionArtists(exhibitionId: string): Promise<PublicExhibitionArtist[]> {
  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('gallery_id, published_at')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (!exhibition) return [];
  if (!exhibition.published_at) {
    const {
      data: { user },
    } = await getSupabaseServerClient().auth.getUser();
    if (!user || !(await canManageExhibition(user.id, exhibition.gallery_id))) return [];
  }
  try {
    const artists = await loadExhibitionArtists(admin, exhibitionId);
    return artists.map((a) => ({
      key: a.key,
      profileId: a.profileId,
      accountId: a.accountId,
      name: a.name,
      picture_url: a.effective.picture_url,
      tombstone: formatTombstone(a.effective),
      bio: a.effective.bio,
      artist_statement: a.effective.artist_statement,
      website: a.effective.website,
    }));
  } catch (e) {
    console.error('[ExhibitionArtists] getPublicExhibitionArtists failed', e);
    return [];
  }
}
