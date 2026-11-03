'use server';

import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { ensureArtistProfileForCertificate } from '~/app/artworks/_actions/ensure-artist-profile-for-certificate';
import { artworkImageUploader } from '~/lib/artwork-storage';
import { generateCertificateNumber } from '~/lib/certificate-claims/insert-linked-certificate';
import { getAccountDisplayName } from '~/lib/certificate-claims/propagate-provenance';
import { normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import { scheduleArtworkFingerprints } from '~/lib/image-fingerprint/schedule';
import { createNotification } from '~/lib/notifications';
import { CERTIFICATE_TYPES, USER_ROLES } from '~/lib/user-roles';
import { ownerReceivesCertificateOfShow } from '../_helpers/exhibition-owner-roles';
import {
  artistUploadNotificationCopy,
  parseArtistUploadItems,
  yearToCreationDate,
} from '../_helpers/artist-upload';

export type UploadArtworksForArtistResult =
  | { success: true; artworkIds: string[]; artistOnPlatform: boolean }
  | { success: false; error: string; artworkIds: string[] };

type ExhibitionRow = { id: string; gallery_id: string; title: string; owner_role: string };

type InviteRow = {
  id: string;
  exhibition_id: string;
  invitee_email: string;
  invitee_name: string | null;
  artist_account_id: string | null;
  status: string;
  submitted_count: number;
};

type ResolvedArtist = {
  name: string;
  accountId: string | null;
  profileId: string | null;
};

/**
 * The artist the works belong to: the invite's linked account, else a
 * platform account with the invite/typed email, else an artist profile
 * matched (or created unclaimed) by name so a later claim picks the works up.
 */
async function resolveArtist(
  adminClient: UntypedSupabaseClient,
  params: {
    invite: InviteRow | null;
    artistName: string;
    artistEmail: string;
    exhibition: ExhibitionRow;
  },
): Promise<ResolvedArtist> {
  const { invite, exhibition } = params;
  const email = normalizeInviteEmail(invite?.invitee_email || params.artistEmail || '');
  let accountId = invite?.artist_account_id ?? null;
  let accountName: string | null = null;

  if (!accountId && email) {
    const { data: account } = await adminClient
      .from('accounts')
      .select('id, name')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    accountId = (account?.id as string | undefined) ?? null;
    accountName = (account?.name as string | null | undefined)?.trim() || null;
  }

  const name =
    invite?.invitee_name?.trim() ||
    params.artistName.trim() ||
    accountName ||
    (email ? email.split('@')[0]! : '') ||
    'Artist';

  if (accountId) {
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('id')
      .eq('user_id', accountId)
      .eq('role', USER_ROLES.ARTIST)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return { name, accountId, profileId: (profile?.id as string | undefined) ?? null };
  }

  const ensured = await ensureArtistProfileForCertificate({
    artistName: name,
    posterAccountId: exhibition.gallery_id,
    posterRole:
      exhibition.owner_role === USER_ROLES.INSTITUTION
        ? USER_ROLES.INSTITUTION
        : USER_ROLES.GALLERY,
  });
  return { name, accountId: ensured.artistAccountId, profileId: ensured.artistProfileId };
}

/**
 * Lets the organiser or a gallery team member (e.g. the registrar) upload
 * works on an artist's behalf for an exhibition or its open call. Each work
 * becomes a verified Certificate of Show owned by the gallery, credited to the
 * artist, and joins the exhibition as selected. Artists on the platform are
 * credited on the show; call notifyArtistOfUploadedArtworks once the whole
 * upload is done so they get one notification.
 *
 * FormData: exhibitionId, inviteId? (from the invites/submissions panels),
 * artistName?, artistEmail?, items (JSON), image_<key> files. The client
 * sends one work per call to stay under the hosting request-size limit.
 */
export async function uploadArtworksForArtist(
  formData: FormData,
): Promise<UploadArtworksForArtistResult> {
  const exhibitionId = (formData.get('exhibitionId') as string | null)?.trim() ?? '';
  const inviteId = (formData.get('inviteId') as string | null)?.trim() || null;
  const artistName = (formData.get('artistName') as string | null)?.trim() ?? '';
  const artistEmail = (formData.get('artistEmail') as string | null)?.trim() ?? '';

  console.log('[Exhibitions] uploadArtworksForArtist started', {
    exhibitionId,
    hasInvite: Boolean(inviteId),
  });

  if (!exhibitionId) return { success: false, error: 'Missing exhibition.', artworkIds: [] };
  if (!inviteId && !artistName && !artistEmail) {
    return { success: false, error: "Enter the artist's name or email.", artworkIds: [] };
  }

  const items = parseArtistUploadItems(formData.get('items') as string | null);
  if ('error' in items) return { success: false, error: items.error, artworkIds: [] };

  try {
    const client = asUntyped(getSupabaseServerClient());
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { success: false, error: 'You must be signed in.', artworkIds: [] };

    const adminClient = asUntyped(getSupabaseServerAdminClient());
    const { data: exhibition, error: exhibitionError } = await adminClient
      .from('exhibitions')
      .select('id, gallery_id, title, owner_role')
      .eq('id', exhibitionId)
      .maybeSingle();
    if (exhibitionError || !exhibition) {
      console.error('[Exhibitions] uploadArtworksForArtist exhibition load failed', exhibitionError);
      return { success: false, error: 'Exhibition not found.', artworkIds: [] };
    }
    if (!(await canManageExhibition(user.id, exhibition.gallery_id))) {
      return { success: false, error: 'Exhibition not found or access denied.', artworkIds: [] };
    }
    if (!ownerReceivesCertificateOfShow(exhibition.owner_role)) {
      return {
        success: false,
        error:
          'Only gallery and institution exhibitions issue Certificates of Show. Invite the artist to upload instead.',
        artworkIds: [],
      };
    }

    let invite: InviteRow | null = null;
    if (inviteId) {
      const { data } = await adminClient
        .from('exhibition_artist_invites')
        .select(
          'id, exhibition_id, invitee_email, invitee_name, artist_account_id, status, submitted_count',
        )
        .eq('id', inviteId)
        .maybeSingle();
      if (!data || data.exhibition_id !== exhibitionId) {
        return { success: false, error: 'Invitation not found.', artworkIds: [] };
      }
      invite = data as InviteRow;
    }

    const artist = await resolveArtist(adminClient, {
      invite,
      artistName,
      artistEmail,
      exhibition: exhibition as ExhibitionRow,
    });

    const galleryRole =
      exhibition.owner_role === USER_ROLES.INSTITUTION
        ? USER_ROLES.INSTITUTION
        : USER_ROLES.GALLERY;
    const { data: galleryProfile } = await adminClient
      .from('user_profiles')
      .select('id, name')
      .eq('user_id', exhibition.gallery_id)
      .eq('role', galleryRole)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const createdIds: string[] = [];

    for (const item of items) {
      const imageFile = formData.get(`image_${item.key}`);
      let imageUrl: string | null = null;
      if (imageFile instanceof File && imageFile.size > 0) {
        try {
          imageUrl = await artworkImageUploader.upload(client, adminClient, imageFile, user.id);
        } catch (uploadErr) {
          console.error('[Exhibitions] uploadArtworksForArtist image upload failed', uploadErr);
          return {
            success: false,
            error: `Image upload failed for "${item.title}". Try a smaller photo.`,
            artworkIds: createdIds,
          };
        }
      }

      const certificateNumber = await generateCertificateNumber(adminClient);
      const { data: inserted, error: insertError } = await adminClient
        .from('artworks')
        .insert({
          account_id: exhibition.gallery_id,
          title: item.title,
          medium: item.medium,
          creation_date: yearToCreationDate(item.year),
          dimensions: item.dimensions,
          image_url: imageUrl,
          artist_name: artist.name,
          artist_account_id: artist.accountId,
          artist_profile_id: artist.profileId,
          gallery_profile_id: galleryProfile?.id ?? null,
          certificate_number: certificateNumber,
          certificate_type: CERTIFICATE_TYPES.SHOW,
          status: 'verified',
          certificate_status: 'verified',
          created_by: user.id,
          updated_by: user.id,
          metadata: {
            exhibition_id: exhibitionId,
            exhibition_title: exhibition.title,
            uploaded_for_artist: true,
            ...(item.price ? { exhibition_list_price: item.price } : {}),
          },
        })
        .select('id')
        .single();

      if (insertError || !inserted?.id) {
        console.error('[Exhibitions] uploadArtworksForArtist artwork insert failed', insertError);
        return {
          success: false,
          error: `Could not create the Certificate of Show for "${item.title}".`,
          artworkIds: createdIds,
        };
      }
      const artworkId = inserted.id as string;

      // cos_artwork_id points at the work itself: it is already the Certificate
      // of Show, so the review panel shows it as selected and won't re-issue one.
      const { error: linkError } = await adminClient.from('exhibition_artworks').insert({
        exhibition_id: exhibitionId,
        artwork_id: artworkId,
        status: 'selected',
        submission_invite_id: invite?.id ?? null,
        cos_artwork_id: artworkId,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      });
      if (linkError) {
        console.error('[Exhibitions] uploadArtworksForArtist exhibition link failed', linkError);
        return {
          success: false,
          error: `"${item.title}" was created but could not be added to the exhibition. Add it from the artworks list.`,
          artworkIds: createdIds,
        };
      }

      createdIds.push(artworkId);
    }

    if (invite) {
      const { error: countError } = await adminClient
        .from('exhibition_artist_invites')
        .update({ submitted_count: (invite.submitted_count ?? 0) + createdIds.length })
        .eq('id', invite.id);
      if (countError) {
        console.error('[Exhibitions] uploadArtworksForArtist submitted_count failed', countError);
      }
    }

    if (artist.accountId) {
      const { error: creditError } = await adminClient.from('exhibition_artists').insert({
        exhibition_id: exhibitionId,
        artist_account_id: artist.accountId,
      });
      if (creditError && creditError.code !== '23505') {
        console.error('[Exhibitions] uploadArtworksForArtist artist credit failed', creditError);
      }
    }

    revalidatePath('/exhibitions');
    revalidatePath(`/exhibitions/${exhibitionId}`);
    revalidatePath(`/exhibitions/${exhibitionId}/edit`);
    if (artist.accountId) revalidatePath(`/artists/${artist.accountId}`);
    scheduleArtworkFingerprints(createdIds);

    console.log('[Exhibitions] uploadArtworksForArtist succeeded', {
      exhibitionId,
      created: createdIds.length,
      artistOnPlatform: Boolean(artist.accountId),
    });
    return {
      success: true,
      artworkIds: createdIds,
      artistOnPlatform: Boolean(artist.accountId),
    };
  } catch (err) {
    console.error('[Exhibitions] uploadArtworksForArtist failed', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
      artworkIds: [],
    };
  }
}

/**
 * Tells the artist (when they're on the platform) about works the organiser
 * uploaded for them. Only counts uploads this exhibition's managers made for
 * it, so it can't be pointed at someone else's artworks.
 */
export async function notifyArtistOfUploadedArtworks(
  exhibitionId: string,
  artworkIds: string[],
): Promise<{ notified: boolean }> {
  const ids = [...new Set(artworkIds)].filter(Boolean);
  if (!exhibitionId || ids.length === 0) return { notified: false };

  try {
    const client = asUntyped(getSupabaseServerClient());
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { notified: false };

    const adminClient = asUntyped(getSupabaseServerAdminClient());
    const { data: exhibition } = await adminClient
      .from('exhibitions')
      .select('id, gallery_id, title, owner_role')
      .eq('id', exhibitionId)
      .maybeSingle();
    if (!exhibition || !(await canManageExhibition(user.id, exhibition.gallery_id))) {
      return { notified: false };
    }

    const [{ data: links }, { data: artworks }] = await Promise.all([
      adminClient
        .from('exhibition_artworks')
        .select('artwork_id')
        .eq('exhibition_id', exhibitionId)
        .in('artwork_id', ids),
      adminClient
        .from('artworks')
        .select('id, title, account_id, artist_account_id, gallery_profile_id, metadata')
        .in('id', ids)
        .eq('account_id', exhibition.gallery_id),
    ]);

    const linked = new Set((links ?? []).map((l: { artwork_id: string }) => l.artwork_id));
    type UploadedRow = {
      id: string;
      title: string | null;
      artist_account_id: string | null;
      gallery_profile_id: string | null;
      metadata: Record<string, unknown> | null;
    };
    const uploaded = ((artworks ?? []) as UploadedRow[]).filter(
      (a) => linked.has(a.id) && a.metadata?.uploaded_for_artist === true && a.artist_account_id,
    );
    const artistAccountId = uploaded[0]?.artist_account_id;
    if (!artistAccountId || artistAccountId === user.id) return { notified: false };
    const forArtist = uploaded.filter((a) => a.artist_account_id === artistAccountId);

    let organiserName = '';
    const galleryProfileId = forArtist[0]?.gallery_profile_id;
    if (galleryProfileId) {
      const { data: profile } = await adminClient
        .from('user_profiles')
        .select('name')
        .eq('id', galleryProfileId)
        .maybeSingle();
      organiserName = (profile?.name as string | null | undefined)?.trim() ?? '';
    }
    if (!organiserName) {
      organiserName = await getAccountDisplayName(adminClient, exhibition.gallery_id);
    }

    const { data: openCall } = await adminClient
      .from('open_calls')
      .select('slug')
      .eq('exhibition_id', exhibitionId)
      .eq('submission_mode', 'exhibition')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const copy = artistUploadNotificationCopy({
      organiserName,
      exhibitionTitle: exhibition.title,
      titles: forArtist.map((a) => a.title?.trim() || 'Untitled'),
      issuedCertificateOfShow: true,
    });
    await createNotification({
      userId: artistAccountId,
      type: 'exhibition_artwork_selected',
      title: copy.title,
      message: copy.message,
      artworkId: forArtist[0]!.id,
      relatedUserId: user.id,
      metadata: {
        exhibition_id: exhibitionId,
        cos_artwork_id: forArtist[0]!.id,
        cos_artwork_ids: forArtist.map((a) => a.id),
        open_call_slug: openCall?.slug ?? null,
        uploaded_for_artist: true,
      },
    });

    console.log('[Exhibitions] notifyArtistOfUploadedArtworks sent', {
      exhibitionId,
      count: forArtist.length,
    });
    return { notified: true };
  } catch (err) {
    console.error('[Exhibitions] notifyArtistOfUploadedArtworks failed', err);
    return { notified: false };
  }
}
