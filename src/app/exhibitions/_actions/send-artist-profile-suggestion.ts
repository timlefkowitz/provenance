'use server';

import { revalidatePath } from 'next/cache';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import {
  buildProfileSuggestion,
  buildProfileUpdateFromSuggestion,
  suggestionFieldKeys,
  FIELD_LABELS,
  type ProfileSuggestionFields,
  type ScalarField,
} from '~/lib/artist-details/fields';
import { createNotification } from '~/lib/notifications';
import { sendNotificationEmail } from '~/lib/email';
import { requireExhibitionManager } from '../_helpers/require-exhibition-manager';
import { loadExhibitionArtists, profileCvJson, profilePress } from '../_helpers/load-exhibition-artists';

export type SendArtistSuggestionResult =
  | { success: true; mode: 'sent' | 'applied'; fields: string[] }
  | { success: false; error: string };

function describeFields(s: ProfileSuggestionFields): string[] {
  return suggestionFieldKeys(s).map((k) =>
    k === 'cv_entries_add' ? FIELD_LABELS.cv_entries : k === 'press_add' ? FIELD_LABELS.press : FIELD_LABELS[k as ScalarField],
  );
}

/**
 * Pass the curator's show copy on to the artist's profile. A claimed artist
 * gets a suggestion to accept; an unclaimed profile the curator's gallery
 * created is updated directly. Only changed fields are sent, and empty show
 * fields never clear the profile.
 */
export async function sendArtistProfileSuggestion(input: {
  exhibitionId: string;
  artistKey: string;
  message?: string;
}): Promise<SendArtistSuggestionResult> {
  const auth = await requireExhibitionManager(input.exhibitionId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { admin, userId, exhibition } = auth.ctx;

  try {
    const artists = await loadExhibitionArtists(admin, input.exhibitionId, {
      canManageGallery: (galleryAccountId) => canManageExhibition(userId, galleryAccountId),
    });
    const artist = artists.find((a) => a.key === input.artistKey);
    if (!artist) return { success: false, error: 'That artist is not in this exhibition.' };
    if (!artist.profile || artist.link === 'name_only') {
      return { success: false, error: 'This artist has no profile yet, so there is nothing to update.' };
    }
    if (artist.link === 'placeholder_other') {
      return { success: false, error: "This artist's profile was created by another gallery and hasn't been claimed yet." };
    }
    if (!artist.show) return { success: false, error: 'Save some changes for this artist first.' };

    const snapshot = {
      ...artist.profileFields,
      artist_cv_json: profileCvJson(artist.profile),
      news_publications: profilePress(artist.profile),
    };
    const suggestion = buildProfileSuggestion(artist.show, snapshot);
    const keys = suggestionFieldKeys(suggestion);
    if (keys.length === 0) {
      return { success: false, error: "The artist's profile already matches your changes." };
    }
    const fields = describeFields(suggestion);

    const { data: acceptedFindings } = await admin
      .from('artist_research_findings')
      .select('id')
      .eq('exhibition_id', input.exhibitionId)
      .eq('artist_key', input.artistKey)
      .eq('status', 'accepted');
    const findingIds = ((acceptedFindings || []) as { id: string }[]).map((f) => f.id);

    if (artist.link === 'placeholder') {
      const update = buildProfileUpdateFromSuggestion(suggestion, snapshot, keys);
      const { error } = await admin.from('user_profiles').update(update).eq('id', artist.profile.id);
      if (error) {
        console.error('[ArtistSuggestions] placeholder update failed', error);
        return { success: false, error: 'Could not update the profile.' };
      }
      console.log('[ArtistSuggestions] updated unclaimed profile directly', {
        profileId: artist.profile.id,
        exhibitionId: input.exhibitionId,
        fields: keys,
      });
      revalidatePath(`/exhibitions/${input.exhibitionId}/curate`);
      revalidatePath(`/artists/${artist.profile.id}`);
      return { success: true, mode: 'applied', fields };
    }

    // Claimed: one open suggestion per artist per show, refreshed on resend.
    const message = input.message?.trim().slice(0, 2000) || null;
    const { data: existing } = await admin
      .from('artist_profile_suggestions')
      .select('id')
      .eq('profile_id', artist.profile.id)
      .eq('exhibition_id', input.exhibitionId)
      .eq('status', 'pending')
      .maybeSingle();
    const row = {
      profile_id: artist.profile.id,
      exhibition_id: input.exhibitionId,
      requested_by: userId,
      update_fields: suggestion,
      source_finding_ids: findingIds,
      message,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = existing
      ? await admin.from('artist_profile_suggestions').update(row).eq('id', existing.id).select('id').single()
      : await admin.from('artist_profile_suggestions').insert(row).select('id').single();
    if (error || !saved) {
      console.error('[ArtistSuggestions] save failed', error);
      return { success: false, error: 'Could not send the changes.' };
    }

    const artistUserId = artist.profile.user_id as string;
    const showTitle = exhibition.title || 'an exhibition';
    const body = `The curator of "${showTitle}" suggested updates to your profile: ${fields.join(', ')}. Review them and choose what to add.`;
    try {
      await createNotification({
        userId: artistUserId,
        type: 'artist_profile_suggestion',
        title: 'Suggested updates to your profile',
        message: body,
        relatedUserId: userId,
        metadata: { suggestion_id: saved.id, exhibition_id: input.exhibitionId, profile_id: artist.profile.id },
      });
    } catch (e) {
      console.error('[ArtistSuggestions] notification failed', e);
    }
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(artistUserId);
      const email = authUser?.user?.email;
      if (email) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
        await sendNotificationEmail(email, artist.name, 'Suggested updates to your artist profile', {
          title: 'Suggested updates to your profile',
          body,
          ctaUrl: `${siteUrl}/profiles/suggestions`,
          ctaLabel: 'Review changes',
        });
      }
    } catch (e) {
      console.error('[ArtistSuggestions] email failed', e);
    }

    console.log('[ArtistSuggestions] sent', {
      suggestionId: saved.id,
      exhibitionId: input.exhibitionId,
      profileId: artist.profile.id,
      fields: keys,
    });
    revalidatePath(`/exhibitions/${input.exhibitionId}/curate`);
    return { success: true, mode: 'sent', fields };
  } catch (e) {
    console.error('[ArtistSuggestions] sendArtistProfileSuggestion failed', e);
    return { success: false, error: (e as Error).message || 'Could not send the changes.' };
  }
}
