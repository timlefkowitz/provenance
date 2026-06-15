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
import {
  ARTWORKS_BUCKET,
  artworkImageUploader,
  getArtworkImagePublicUrl,
} from '~/lib/artwork-storage';

export type SubmitExhibitionArtworkResult =
  | {
      success: true;
      artworkId: string;
      cosArtworkId: string;
      count: number;
      finalized: boolean;
      coaIds: string[];
    }
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

type ParsedArtworkInput = {
  existingCoaId: string | null;
  title: string;
  description: string;
  medium: string;
  creationDate: string;
  dimensions: string;
  formerOwners: string;
  auctionHistory: string;
  exhibitionHistory: string;
  historicContext: string;
  celebrityNotes: string;
  value: string;
  edition: string;
  productionLocation: string;
  ownedBy: string;
  soldBy: string;
  images: File[];
};

type BatchMeta = {
  batchIndex: number;
  totalBatches: number;
  finalize: boolean;
  totalArtworkCount: number;
  sessionFirstCoaId: string;
  sessionFirstCosId: string;
};

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
}

function getTextField(formData: FormData, key: string): string {
  return (formData.get(key) as string | null)?.trim() ?? '';
}

function parseBatchMeta(formData: FormData): BatchMeta {
  const batchIndexRaw = formData.get('batchIndex');
  const totalBatchesRaw = formData.get('totalBatches');
  const batchIndex = Number.parseInt(String(batchIndexRaw ?? '0'), 10);
  const totalBatches = Number.parseInt(String(totalBatchesRaw ?? '1'), 10);
  const finalize = formData.get('finalize')?.toString() !== 'false';
  const totalArtworkCount = Number.parseInt(
    String(formData.get('totalArtworkCount') ?? formData.get('count') ?? '0'),
    10,
  );

  return {
    batchIndex: Number.isFinite(batchIndex) ? batchIndex : 0,
    totalBatches: Number.isFinite(totalBatches) && totalBatches > 0 ? totalBatches : 1,
    finalize,
    totalArtworkCount: Number.isFinite(totalArtworkCount) ? totalArtworkCount : 0,
    sessionFirstCoaId: getTextField(formData, 'sessionFirstCoaId'),
    sessionFirstCosId: getTextField(formData, 'sessionFirstCosId'),
  };
}

function parseArtworkInputs(formData: FormData): ParsedArtworkInput[] | { error: string } {
  const countRaw = formData.get('count');
  const count = Number.parseInt(String(countRaw ?? ''), 10);

  if (!Number.isFinite(count) || count < 1) {
    return { error: 'At least one artwork is required' };
  }

  const artworks: ParsedArtworkInput[] = [];

  for (let i = 0; i < count; i++) {
    const prefix = `artwork_${i}_`;
    const existingCoaId = getTextField(formData, `${prefix}existingCoaId`) || null;
    const title = getTextField(formData, `${prefix}title`);
    const images = formData
      .getAll(`images_${i}`)
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (images.length === 0) {
      return { error: `At least one photo is required for artwork ${i + 1}` };
    }

    if (!existingCoaId && !title) {
      return { error: `Title is required for artwork ${i + 1}` };
    }

    artworks.push({
      existingCoaId,
      title,
      description: getTextField(formData, `${prefix}description`),
      medium: getTextField(formData, `${prefix}medium`),
      creationDate: getTextField(formData, `${prefix}creationDate`),
      dimensions: getTextField(formData, `${prefix}dimensions`),
      formerOwners: getTextField(formData, `${prefix}formerOwners`),
      auctionHistory: getTextField(formData, `${prefix}auctionHistory`),
      exhibitionHistory: getTextField(formData, `${prefix}exhibitionHistory`),
      historicContext: getTextField(formData, `${prefix}historicContext`),
      celebrityNotes: getTextField(formData, `${prefix}celebrityNotes`),
      value: getTextField(formData, `${prefix}value`),
      edition: getTextField(formData, `${prefix}edition`),
      productionLocation: getTextField(formData, `${prefix}productionLocation`),
      ownedBy: getTextField(formData, `${prefix}ownedBy`),
      soldBy: getTextField(formData, `${prefix}soldBy`),
      images,
    });
  }

  return artworks;
}

async function uploadExtraAttachment(
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  userId: string,
  coaId: string,
  file: File,
): Promise<void> {
  const mime = (file.type || 'application/octet-stream').toLowerCase();
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(mime)) {
    console.error('[Exhibitions] extra attachment skipped: unsupported type', { mime, coaId });
    return;
  }

  const safeName = sanitizeFileName(file.name);
  const extFromMime = mime.includes('png')
    ? 'png'
    : mime.includes('webp')
      ? 'webp'
      : mime.includes('gif')
        ? 'gif'
        : 'jpg';
  const storagePath = `${userId}/attachments/${coaId}/${Date.now()}-${safeName.replace(/\.[^.]+$/, '') || 'file'}.${extFromMime}`;

  const bytes = await file.arrayBuffer();
  const bucket = adminClient.storage.from(ARTWORKS_BUCKET);
  const { error: uploadError } = await bucket.upload(storagePath, bytes, {
    contentType: mime,
    upsert: false,
  });

  if (uploadError) {
    console.error('[Exhibitions] extra attachment upload failed', uploadError, { coaId });
    return;
  }

  const fileUrl = getArtworkImagePublicUrl(storagePath);
  const { error: insertError } = await (adminClient as any)
    .from('artwork_attachments')
    .insert({
      artwork_id: coaId,
      account_id: userId,
      file_url: fileUrl,
      file_name: safeName,
      file_type: 'image',
    });

  if (insertError) {
    console.error('[Exhibitions] extra attachment insert failed', insertError, { coaId });
    await bucket.remove([storagePath]).catch((e) =>
      console.error('[Exhibitions] extra attachment rollback failed', e),
    );
  }
}

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

async function verifyExistingCoa(
  adminClient: ReturnType<typeof getSupabaseServerAdminClient>,
  userId: string,
  coaId: string,
  exhibitionId: string,
): Promise<boolean> {
  const { data: artwork, error } = await (adminClient as any)
    .from('artworks')
    .select('id, account_id, metadata')
    .eq('id', coaId)
    .maybeSingle();

  if (error || !artwork) {
    console.error('[Exhibitions] existing COA lookup failed', error, { coaId });
    return false;
  }

  if (artwork.account_id !== userId) {
    return false;
  }

  const metadata = artwork.metadata as Record<string, unknown> | null;
  return (
    metadata?.submitted_via_exhibition_invite === true &&
    metadata?.exhibition_id === exhibitionId
  );
}

export async function submitExhibitionArtwork(
  token: string,
  formData: FormData,
): Promise<SubmitExhibitionArtworkResult> {
  const batch = parseBatchMeta(formData);
  console.log('[Exhibitions] submitExhibitionArtwork started', {
    batchIndex: batch.batchIndex + 1,
    totalBatches: batch.totalBatches,
    finalize: batch.finalize,
  });

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

    if (invite.status === 'consumed' && !batch.finalize) {
      return { success: false, error: 'This invitation has already been used' };
    }

    const inviteeEmail = normalizeInviteEmail(invite.invitee_email);
    if (!emailsMatch(user.email, inviteeEmail)) {
      return {
        success: false,
        error: `Sign in with the email this invite was sent to (${inviteeEmail}).`,
      };
    }

    const parsed = parseArtworkInputs(formData);
    if ('error' in parsed) {
      return { success: false, error: parsed.error };
    }

    const artworks = parsed;
    console.log('[Exhibitions] submitExhibitionArtwork processing batch artworks', {
      batchIndex: batch.batchIndex + 1,
      totalBatches: batch.totalBatches,
      finalize: batch.finalize,
      count: artworks.length,
    });

    const { data: exhibition, error: exhibitionError } = await (adminClient as any)
      .from('exhibitions')
      .select('id, gallery_id, title, owner_role')
      .eq('id', invite.exhibition_id)
      .single();

    if (exhibitionError || !exhibition) {
      console.error('[Exhibitions] submitExhibitionArtwork exhibition load failed', exhibitionError);
      return { success: false, error: 'Exhibition not found' };
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

    const createdCoaIds: string[] = [];
    const createdCosIds: string[] = [];
    let batchFirstCoaId = '';
    let batchFirstCosId = '';

    for (let index = 0; index < artworks.length; index++) {
      const artwork = artworks[index];

      if (artwork.existingCoaId) {
        const ok = await verifyExistingCoa(
          adminClient,
          user.id,
          artwork.existingCoaId,
          invite.exhibition_id,
        );
        if (!ok) {
          return {
            success: false,
            error: 'Could not add photos to an existing artwork from this submission',
          };
        }

        for (const extraImage of artwork.images) {
          try {
            await uploadExtraAttachment(
              adminClient,
              user.id,
              artwork.existingCoaId,
              extraImage,
            );
          } catch (attachmentErr) {
            console.error('[Exhibitions] continuation attachment failed (non-fatal)', attachmentErr, {
              coaId: artwork.existingCoaId,
            });
          }
        }

        createdCoaIds.push(artwork.existingCoaId);
        if (!batchFirstCoaId) batchFirstCoaId = artwork.existingCoaId;

        console.log('[Exhibitions] submitExhibitionArtwork photos added to existing COA', {
          index,
          coaId: artwork.existingCoaId,
        });
        continue;
      }

      const [primaryImage, ...extraImages] = artwork.images;

      let imageUrl: string;
      try {
        imageUrl = await artworkImageUploader.upload(
          client,
          adminClient,
          primaryImage,
          user.id,
        );
      } catch (uploadError) {
        console.error('[Exhibitions] submitExhibitionArtwork image upload failed', uploadError, {
          index,
        });
        return {
          success: false,
          error:
            uploadError instanceof Error
              ? uploadError.message
              : `Failed to upload image for artwork ${index + 1}`,
        };
      }

      const certificateNumber = await generateCertificateNumber(adminClient);

      const coaPayload: Record<string, unknown> = {
        account_id: user.id,
        title: artwork.title,
        description: artwork.description,
        artist_name: artistName,
        medium: artwork.medium,
        dimensions: artwork.dimensions || null,
        creation_date: artwork.creationDate || null,
        former_owners: artwork.formerOwners || null,
        auction_history: artwork.auctionHistory || null,
        exhibition_history: artwork.exhibitionHistory || null,
        historic_context: artwork.historicContext || null,
        celebrity_notes: artwork.celebrityNotes || null,
        value: artwork.value || null,
        edition: artwork.edition || null,
        production_location: artwork.productionLocation || null,
        owned_by: artwork.ownedBy || null,
        sold_by: artwork.soldBy || null,
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
        console.error('[Exhibitions] submitExhibitionArtwork COA insert failed', coaError, {
          index,
        });
        return {
          success: false,
          error: `Failed to create Certificate of Authenticity for artwork ${index + 1}`,
        };
      }

      const coaId = coaArtwork.id as string;
      createdCoaIds.push(coaId);
      if (!batchFirstCoaId) batchFirstCoaId = coaId;

      await (adminClient as any).from('exhibition_artworks').insert({
        exhibition_id: invite.exhibition_id,
        artwork_id: coaId,
      });

      for (const extraImage of extraImages) {
        try {
          await uploadExtraAttachment(adminClient, user.id, coaId, extraImage);
        } catch (attachmentErr) {
          console.error('[Exhibitions] extra attachment failed (non-fatal)', attachmentErr, {
            coaId,
          });
        }
      }

      let cosArtworkId: string;
      try {
        const { id } = await insertLinkedCoSFromArtistCoa(adminClient, coaArtwork, {
          galleryAccountId: exhibition.gallery_id,
          createdByUserId: user.id,
          galleryProfileId: galleryProfile?.id ?? null,
        });
        cosArtworkId = id;
      } catch (cosErr) {
        console.error('[Exhibitions] submitExhibitionArtwork COS creation failed', cosErr, {
          index,
          coaId,
        });
        return {
          success: false,
          error: `Artwork "${artwork.title}" saved but failed to create gallery Certificate of Show`,
        };
      }

      createdCosIds.push(cosArtworkId);
      if (!batchFirstCosId) batchFirstCosId = cosArtworkId;

      await (adminClient as any).from('exhibition_artworks').insert({
        exhibition_id: invite.exhibition_id,
        artwork_id: cosArtworkId,
      });

      console.log('[Exhibitions] submitExhibitionArtwork artwork created', {
        batchIndex: batch.batchIndex + 1,
        index,
        coaId,
        cosArtworkId,
      });
    }

    const { error: artistLinkError } = await (adminClient as any)
      .from('exhibition_artists')
      .insert({
        exhibition_id: invite.exhibition_id,
        artist_account_id: user.id,
      });

    if (artistLinkError && artistLinkError.code !== '23505') {
      console.error('[Exhibitions] submitExhibitionArtwork artist link failed', artistLinkError);
    }

    const sessionFirstCoaId = batch.sessionFirstCoaId || batchFirstCoaId;
    const sessionFirstCosId = batch.sessionFirstCosId || batchFirstCosId;

    if (batch.finalize) {
      const now = new Date().toISOString();
      await (adminClient as any)
        .from('exhibition_artist_invites')
        .update({
          status: 'consumed',
          consumed_at: now,
          consumed_by: user.id,
          result_artwork_id: sessionFirstCoaId,
          result_cos_artwork_id: sessionFirstCosId,
        })
        .eq('id', invite.id);

      const totalCount =
        batch.totalArtworkCount > 0 ? batch.totalArtworkCount : artworks.length;
      const notificationTitle =
        totalCount === 1
          ? `Artwork submitted: ${artworks.find((a) => !a.existingCoaId)?.title ?? 'Artwork'}`
          : `${totalCount} artworks submitted by ${artistName}`;
      const notificationMessage =
        totalCount === 1
          ? `${artistName} submitted artwork for "${exhibition.title}". A Certificate of Show has been linked to your exhibition.`
          : `${artistName} submitted ${totalCount} artworks for "${exhibition.title}". Certificates of Show have been linked to your exhibition.`;

      try {
        await createNotification({
          userId: exhibition.gallery_id,
          type: 'exhibition_artwork_submitted',
          title: notificationTitle,
          message: notificationMessage,
          artworkId: sessionFirstCosId,
          relatedUserId: user.id,
          metadata: {
            exhibition_id: invite.exhibition_id,
            coa_artwork_id: sessionFirstCoaId,
            cos_artwork_id: sessionFirstCosId,
            artwork_count: totalCount,
          },
        });
      } catch (notifyErr) {
        console.error('[Exhibitions] submitExhibitionArtwork notify failed', notifyErr);
      }
    }

    revalidatePath(`/exhibitions/${invite.exhibition_id}`);
    revalidatePath(`/exhibitions/${invite.exhibition_id}/edit`);
    revalidatePath('/artworks/my');

    for (let i = 0; i < createdCoaIds.length; i++) {
      revalidatePath(`/artworks/${createdCoaIds[i]}/certificate`);
      if (createdCosIds[i]) {
        revalidatePath(`/artworks/${createdCosIds[i]}/certificate`);
      }
    }

    console.log('[Exhibitions] submitExhibitionArtwork batch succeeded', {
      batchIndex: batch.batchIndex + 1,
      totalBatches: batch.totalBatches,
      finalize: batch.finalize,
      count: artworks.length,
      sessionFirstCoaId,
    });

    return {
      success: true,
      artworkId: sessionFirstCoaId || batchFirstCoaId,
      cosArtworkId: sessionFirstCosId || batchFirstCosId,
      count: batch.totalArtworkCount > 0 ? batch.totalArtworkCount : artworks.length,
      finalized: batch.finalize,
      coaIds: createdCoaIds,
    };
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
