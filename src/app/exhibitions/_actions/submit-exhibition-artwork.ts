'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import { CERTIFICATE_TYPES, USER_ROLES } from '~/lib/user-roles';
import {
  emailsMatch,
  hashClaimToken,
  normalizeInviteEmail,
} from '~/lib/certificate-claims/tokens';
import { generateCertificateNumber } from '~/lib/certificate-claims/insert-linked-certificate';
import { insertLinkedCoSFromArtistCoa } from '~/lib/certificate-claims/insert-linked-cos-from-artist-coa';
import { artworkImageUploader } from '~/lib/artwork-storage';

export type SubmitExhibitionArtworkResult =
  | { success: true; artworkId: string; cosArtworkId: string }
  | { success: false; error: string };

type InviteRow = {
  id: string;
  exhibition_id: string;
  invitee_email: string;
  invitee_name: string | null;
  artist_account_id: string | null;
  status: string;
  expires_at: string;
};

async function validateInvite(
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  token: string,
): Promise<{ invite: InviteRow } | { error: string }> {
  const trimmed = token?.trim();
  if (!trimmed) {
    return { error: 'Invalid or missing invite link' };
  }

  const tokenHash = hashClaimToken(trimmed);
  const { data: invite, error } = await (adminClient as any)
    .from('exhibition_artist_invites')
    .select(
      'id, exhibition_id, invitee_email, invitee_name, artist_account_id, status, expires_at',
    )
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !invite) {
    console.error('[Exhibitions] submitExhibitionArtwork invite lookup failed', error);
    return { error: 'Invalid or expired invite link' };
  }

  if (invite.status === 'cancelled') {
    return { error: 'This invitation has been cancelled' };
  }

  if (invite.status === 'consumed') {
    return { error: 'This invitation has already been used' };
  }

  const expiresAt = new Date(invite.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
    await (adminClient as any)
      .from('exhibition_artist_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return { error: 'This invitation has expired' };
  }

  return { invite: invite as InviteRow };
}

export async function submitExhibitionArtwork(
  token: string,
  formData: FormData,
): Promise<SubmitExhibitionArtworkResult> {
  console.log('[Exhibitions] submitExhibitionArtwork started');

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in to submit artwork' };
    }

    if (!user.email) {
      return {
        success: false,
        error: 'Your account has no email; add one to complete this submission',
      };
    }

    const adminClient = getSupabaseServerAdminClient();
    const validated = await validateInvite(adminClient, token);
    if ('error' in validated) {
      return { success: false, error: validated.error };
    }

    const { invite } = validated;
    const inviteeEmail = normalizeInviteEmail(invite.invitee_email);
    if (!emailsMatch(user.email, inviteeEmail)) {
      return {
        success: false,
        error: `Sign in with the email this invite was sent to (${inviteeEmail}).`,
      };
    }

    const imageFile = formData.get('image') as File | null;
    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || '';
    const medium = (formData.get('medium') as string)?.trim() || '';
    const creationDate = (formData.get('creationDate') as string)?.trim() || '';
    const dimensions = (formData.get('dimensions') as string)?.trim() || '';

    if (!imageFile || !title) {
      return { success: false, error: 'Title and image are required' };
    }

    const { data: exhibition, error: exhibitionError } = await (adminClient as any)
      .from('exhibitions')
      .select('id, gallery_id, title, owner_role')
      .eq('id', invite.exhibition_id)
      .single();

    if (exhibitionError || !exhibition) {
      console.error('[Exhibitions] submitExhibitionArtwork exhibition load failed', exhibitionError);
      return { success: false, error: 'Exhibition not found' };
    }

    let imageUrl: string;
    try {
      imageUrl = await artworkImageUploader.upload(
        client,
        adminClient,
        imageFile,
        user.id,
      );
    } catch (uploadError) {
      console.error('[Exhibitions] submitExhibitionArtwork image upload failed', uploadError);
      return {
        success: false,
        error:
          uploadError instanceof Error
            ? uploadError.message
            : 'Failed to upload image',
      };
    }

    const { data: account } = await client
      .from('accounts')
      .select('id, name, public_data')
      .eq('id', user.id)
      .maybeSingle();

    const artistName =
      invite.invitee_name?.trim() ||
      account?.name ||
      user.email.split('@')[0] ||
      'Artist';

    const certificateNumber = await generateCertificateNumber(adminClient);

    const coaPayload: Record<string, unknown> = {
      account_id: user.id,
      title,
      description,
      artist_name: artistName,
      medium,
      dimensions: dimensions || null,
      creation_date: creationDate || null,
      image_url: imageUrl,
      certificate_number: certificateNumber,
      status: 'verified',
      certificate_type: CERTIFICATE_TYPES.AUTHENTICITY,
      certificate_status: 'verified',
      artist_account_id: user.id,
      created_by: user.id,
      updated_by: user.id,
      metadata: {
        exhibition_id: invite.exhibition_id,
        exhibition_title: exhibition.title,
        submitted_via_exhibition_invite: true,
      },
    };

    const { data: coaArtwork, error: coaError } = await (adminClient as any)
      .from('artworks')
      .insert(coaPayload)
      .select('id, *')
      .single();

    if (coaError || !coaArtwork) {
      console.error('[Exhibitions] submitExhibitionArtwork COA insert failed', coaError);
      return { success: false, error: 'Failed to create Certificate of Authenticity' };
    }

    const coaId = coaArtwork.id as string;

    await (adminClient as any).from('exhibition_artworks').insert({
      exhibition_id: invite.exhibition_id,
      artwork_id: coaId,
    });

    const { error: artistLinkError } = await (adminClient as any)
      .from('exhibition_artists')
      .insert({
        exhibition_id: invite.exhibition_id,
        artist_account_id: user.id,
      });

    if (artistLinkError && artistLinkError.code !== '23505') {
      console.error('[Exhibitions] submitExhibitionArtwork artist link failed', artistLinkError);
    }

    const ownerRole = exhibition.owner_role as string;
    const galleryRole =
      ownerRole === USER_ROLES.INSTITUTION
        ? USER_ROLES.INSTITUTION
        : USER_ROLES.GALLERY;

    const { data: galleryProfile } = await (adminClient as any)
      .from('user_profiles')
      .select('id')
      .eq('user_id', exhibition.gallery_id)
      .eq('role', galleryRole)
      .eq('is_active', true)
      .maybeSingle();

    let cosArtworkId: string;
    try {
      const { id } = await insertLinkedCoSFromArtistCoa(adminClient, coaArtwork, {
        galleryAccountId: exhibition.gallery_id,
        createdByUserId: user.id,
        galleryProfileId: galleryProfile?.id ?? null,
      });
      cosArtworkId = id;
    } catch (cosErr) {
      console.error('[Exhibitions] submitExhibitionArtwork COS creation failed', cosErr);
      return {
        success: false,
        error: 'Artwork saved but failed to create gallery Certificate of Show',
      };
    }

    await (adminClient as any).from('exhibition_artworks').insert({
      exhibition_id: invite.exhibition_id,
      artwork_id: cosArtworkId,
    });

    const now = new Date().toISOString();
    await (adminClient as any)
      .from('exhibition_artist_invites')
      .update({
        status: 'consumed',
        consumed_at: now,
        consumed_by: user.id,
        result_artwork_id: coaId,
        result_cos_artwork_id: cosArtworkId,
      })
      .eq('id', invite.id);

    try {
      await createNotification({
        userId: exhibition.gallery_id,
        type: 'exhibition_artwork_submitted',
        title: `Artwork submitted: ${title}`,
        message: `${artistName} submitted "${title}" for "${exhibition.title}". A Certificate of Show has been linked to your exhibition.`,
        artworkId: cosArtworkId,
        relatedUserId: user.id,
        metadata: {
          exhibition_id: invite.exhibition_id,
          coa_artwork_id: coaId,
          cos_artwork_id: cosArtworkId,
        },
      });
    } catch (notifyErr) {
      console.error('[Exhibitions] submitExhibitionArtwork notify failed', notifyErr);
    }

    revalidatePath(`/exhibitions/${invite.exhibition_id}`);
    revalidatePath(`/exhibitions/${invite.exhibition_id}/edit`);
    revalidatePath(`/artworks/${coaId}/certificate`);
    revalidatePath(`/artworks/${cosArtworkId}/certificate`);

    console.log('[Exhibitions] submitExhibitionArtwork succeeded', {
      coaId,
      cosArtworkId,
    });

    return { success: true, artworkId: coaId, cosArtworkId };
  } catch (err) {
    console.error('[Exhibitions] submitExhibitionArtwork failed', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Submission failed',
    };
  }
}

export async function validateExhibitionSubmitAccess(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user?.email) {
    return { ok: false, error: 'Sign in required' };
  }

  const adminClient = getSupabaseServerAdminClient();
  const validated = await validateInvite(adminClient, token);
  if ('error' in validated) {
    return { ok: false, error: validated.error };
  }

  if (!emailsMatch(user.email, validated.invite.invitee_email)) {
    return {
      ok: false,
      error: `Sign in with ${normalizeInviteEmail(validated.invite.invitee_email)}`,
    };
  }

  return { ok: true };
}
