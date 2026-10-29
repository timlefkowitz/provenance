'use server';

import { asUntyped, UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import { CERTIFICATE_TYPES, USER_ROLES } from '~/lib/user-roles';
import { getInstitutionLockError } from '~/lib/institution-account-guard';
import {
  emailsMatch,
  hashClaimToken,
  normalizeInviteEmail,
} from '~/lib/certificate-claims/tokens';
import { generateCertificateNumber } from '~/lib/certificate-claims/insert-linked-certificate';
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
  max_artworks: number | null;
  submitted_count: number;
  source: string;
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
  adminClient: UntypedSupabaseClient,
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
  const { error: insertError } = await asUntyped(adminClient)
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
  adminClient: UntypedSupabaseClient,
  token: string,
): Promise<{ invite: InviteRow } | { error: string }> {
  const trimmed = token?.trim();
  if (!trimmed) {
    return { error: 'Invalid or missing invite link' };
  }

  const tokenHash = hashClaimToken(trimmed);
  const { data: invite, error } = await asUntyped(adminClient)
    .from('exhibition_artist_invites')
    .select(
      'id, exhibition_id, invitee_email, invitee_name, artist_account_id, status, max_artworks, submitted_count, source, expires_at',
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
    await asUntyped(adminClient)
      .from('exhibition_artist_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return { error: 'This invitation has expired' };
  }

  return { invite: invite as InviteRow };
}

async function verifyExistingCoa(
  adminClient: UntypedSupabaseClient,
  userId: string,
  coaId: string,
  exhibitionId: string,
): Promise<boolean> {
  const { data: artwork, error } = await asUntyped(adminClient)
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

type SubmissionContext = {
  client: UntypedSupabaseClient;
  adminClient: UntypedSupabaseClient;
  user: { id: string; email: string };
  invite: InviteRow;
  exhibition: { id: string; gallery_id: string; title: string; owner_role: string };
  artistName: string;
};

/** Signed-in invitee + valid invite + exhibition, shared by every submit path. */
async function loadSubmissionContext(
  token: string,
): Promise<SubmissionContext | { error: string }> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in to submit artwork' };
  }
  if (!user.email) {
    return { error: 'Your account has no email; add one to complete this submission' };
  }

  const lockError = await getInstitutionLockError(user.id, USER_ROLES.ARTIST);
  if (lockError) {
    return { error: lockError };
  }

  const adminClient = asUntyped(getSupabaseServerAdminClient());
  const validated = await validateInvite(adminClient, token);
  if ('error' in validated) {
    return { error: validated.error };
  }
  const { invite } = validated;

  const inviteeEmail = normalizeInviteEmail(invite.invitee_email);
  if (!emailsMatch(user.email, inviteeEmail)) {
    return { error: `Sign in with the email this invite was sent to (${inviteeEmail}).` };
  }

  const { data: exhibition, error: exhibitionError } = await adminClient
    .from('exhibitions')
    .select('id, gallery_id, title, owner_role')
    .eq('id', invite.exhibition_id)
    .single();

  if (exhibitionError || !exhibition) {
    console.error('[Exhibitions] submission exhibition load failed', exhibitionError);
    return { error: 'Exhibition not found' };
  }

  const { data: account } = await client
    .from('accounts')
    .select('id, name')
    .eq('id', user.id)
    .maybeSingle();

  const artistName =
    invite.invitee_name?.trim() || account?.name || user.email.split('@')[0] || 'Artist';

  return {
    client,
    adminClient,
    user: { id: user.id, email: user.email },
    invite,
    exhibition,
    artistName,
  };
}

/** Error message when this batch would take the invite past its upload limit. */
function checkSubmissionLimit(
  invite: InviteRow,
  newInBatch: number,
  plannedTotal: number,
): string | null {
  if (!invite.max_artworks) return null;
  const planned = Math.max(plannedTotal, (invite.submitted_count ?? 0) + newInBatch);
  if (planned <= invite.max_artworks) return null;
  return `This invitation allows up to ${invite.max_artworks} ${invite.max_artworks === 1 ? 'artwork' : 'artworks'}`;
}

async function incrementSubmittedCount(
  adminClient: UntypedSupabaseClient,
  invite: InviteRow,
  added: number,
): Promise<void> {
  if (added <= 0) return;
  invite.submitted_count = (invite.submitted_count ?? 0) + added;
  const { error } = await adminClient
    .from('exhibition_artist_invites')
    .update({ submitted_count: invite.submitted_count })
    .eq('id', invite.id);
  if (error) {
    console.error('[Exhibitions] submitted_count update failed', { inviteId: invite.id, error });
  }
}

/** Marks the invite used and tells the organiser what arrived. */
async function finalizeInviteSubmission(
  ctx: SubmissionContext,
  params: {
    totalCount: number;
    firstTitle: string;
    sessionFirstCoaId: string;
    sessionFirstCosId: string;
  },
): Promise<void> {
  const { adminClient, user, invite, exhibition, artistName } = ctx;
  const { totalCount, firstTitle, sessionFirstCoaId, sessionFirstCosId } = params;

  await adminClient
    .from('exhibition_artist_invites')
    .update({
      status: 'consumed',
      consumed_at: new Date().toISOString(),
      consumed_by: user.id,
      result_artwork_id: sessionFirstCoaId || null,
      result_cos_artwork_id: sessionFirstCosId || null,
    })
    .eq('id', invite.id);

  const viaOpenCall = invite.source === 'open_call' ? ' via your open call' : '';
  const notificationTitle =
    totalCount === 1
      ? `Artwork submitted: ${firstTitle}`
      : `${totalCount} artworks submitted by ${artistName}`;
  const notificationMessage = `${artistName} submitted ${totalCount === 1 ? 'an artwork' : `${totalCount} artworks`} for "${exhibition.title}"${viaOpenCall}. Select the works you want to show from the exhibition's edit page; nothing is public until you do.`;

  try {
    await createNotification({
      userId: exhibition.gallery_id,
      type: 'exhibition_artwork_submitted',
      title: notificationTitle,
      message: notificationMessage,
      artworkId: sessionFirstCoaId || undefined,
      relatedUserId: user.id,
      metadata: {
        exhibition_id: invite.exhibition_id,
        coa_artwork_id: sessionFirstCoaId,
        cos_artwork_id: sessionFirstCosId || null,
        artwork_count: totalCount,
      },
    });
  } catch (notifyErr) {
    console.error('[Exhibitions] submission notify failed', notifyErr);
  }
}

/**
 * Links a submitted CoA to the exhibition as 'submitted': only the organiser
 * sees it until they select it (which also issues any Certificate of Show).
 */
async function insertSubmittedArtwork(ctx: SubmissionContext, coaId: string): Promise<boolean> {
  const { error } = await ctx.adminClient.from('exhibition_artworks').insert({
    exhibition_id: ctx.invite.exhibition_id,
    artwork_id: coaId,
    status: 'submitted',
    submission_invite_id: ctx.invite.id,
  });
  if (error) {
    console.error('[Exhibitions] submitted artwork link failed', { coaId, error });
    return false;
  }
  return true;
}

export type ExistingArtworkOption = {
  id: string;
  title: string;
  imageUrl: string | null;
  creationDate: string | null;
  medium: string | null;
};

/**
 * The invitee's own Certificates of Authenticity that aren't already in this
 * exhibition, for the "choose from your artworks" picker.
 */
export async function getExistingArtworksForSubmission(
  token: string,
): Promise<{ artworks: ExistingArtworkOption[] } | { error: string }> {
  const ctx = await loadSubmissionContext(token);
  if ('error' in ctx) return { error: ctx.error };

  const [{ data: rows, error }, { data: linked }] = await Promise.all([
    ctx.adminClient
      .from('artworks')
      .select('id, title, image_url, creation_date, medium')
      .eq('account_id', ctx.user.id)
      .eq('certificate_type', CERTIFICATE_TYPES.AUTHENTICITY)
      .order('created_at', { ascending: false })
      .limit(300),
    ctx.adminClient
      .from('exhibition_artworks')
      .select('artwork_id')
      .eq('exhibition_id', ctx.invite.exhibition_id),
  ]);

  if (error) {
    console.error('[Exhibitions] getExistingArtworksForSubmission failed', error);
    return { error: 'Could not load your artworks' };
  }

  const alreadyIn = new Set((linked ?? []).map((r: { artwork_id: string }) => r.artwork_id));
  return {
    artworks: (rows ?? [])
      .filter((r: { id: string }) => !alreadyIn.has(r.id))
      .map(
        (r: {
          id: string;
          title: string | null;
          image_url: string | null;
          creation_date: string | null;
          medium: string | null;
        }) => ({
          id: r.id,
          title: r.title?.trim() || 'Untitled',
          imageUrl: r.image_url,
          creationDate: r.creation_date,
          medium: r.medium,
        }),
      ),
  };
}

/**
 * Submits artworks already on the artist's account: links each CoA to the
 * exhibition (plus a Certificate of Show for gallery/institution shows).
 * Counts toward the invite's upload limit like a new upload.
 */
export async function submitExistingArtworksToExhibition(
  token: string,
  artworkIds: string[],
  options: { finalize: boolean; totalArtworkCount: number },
): Promise<
  | { success: true; coaIds: string[]; firstCoaId: string; firstCosId: string }
  | { success: false; error: string }
> {
  const ids = [...new Set(artworkIds)].filter(Boolean);
  console.log('[Exhibitions] submitExistingArtworksToExhibition started', {
    count: ids.length,
    finalize: options.finalize,
  });
  if (ids.length === 0) {
    return { success: false, error: 'Choose at least one artwork' };
  }

  try {
    const ctx = await loadSubmissionContext(token);
    if ('error' in ctx) return { success: false, error: ctx.error };
    const { adminClient, user, invite } = ctx;

    const limitError = checkSubmissionLimit(invite, ids.length, options.totalArtworkCount);
    if (limitError) return { success: false, error: limitError };

    const { data: artworks, error } = await adminClient
      .from('artworks')
      .select('*')
      .in('id', ids)
      .eq('account_id', user.id)
      .eq('certificate_type', CERTIFICATE_TYPES.AUTHENTICITY);

    if (error || !artworks || artworks.length !== ids.length) {
      console.error('[Exhibitions] submitExistingArtworksToExhibition lookup failed', error);
      return { success: false, error: 'Some of those artworks are not on your account' };
    }

    const { data: linked } = await adminClient
      .from('exhibition_artworks')
      .select('artwork_id')
      .eq('exhibition_id', invite.exhibition_id)
      .in('artwork_id', ids);
    if ((linked ?? []).length > 0) {
      return { success: false, error: 'One of those artworks is already in this exhibition' };
    }

    const coaIds: string[] = [];
    for (const artwork of artworks as Array<{ id: string; title: string }>) {
      if (!(await insertSubmittedArtwork(ctx, artwork.id))) {
        await incrementSubmittedCount(adminClient, invite, coaIds.length);
        return { success: false, error: `Could not submit "${artwork.title}"; try again` };
      }
      coaIds.push(artwork.id);
    }

    await incrementSubmittedCount(adminClient, invite, coaIds.length);

    const firstCoaId = coaIds[0]!;
    if (options.finalize) {
      await finalizeInviteSubmission(ctx, {
        totalCount: options.totalArtworkCount > 0 ? options.totalArtworkCount : coaIds.length,
        firstTitle: (artworks[0] as { title: string }).title,
        sessionFirstCoaId: firstCoaId,
        sessionFirstCosId: '',
      });
    }

    revalidatePath(`/exhibitions/${invite.exhibition_id}`);
    revalidatePath(`/exhibitions/${invite.exhibition_id}/edit`);
    console.log('[Exhibitions] submitExistingArtworksToExhibition succeeded', {
      count: coaIds.length,
    });
    return { success: true, coaIds, firstCoaId, firstCosId: '' };
  } catch (err) {
    console.error('[Exhibitions] submitExistingArtworksToExhibition failed', err);
    return { success: false, error: err instanceof Error ? err.message : 'Submission failed' };
  }
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
    const ctx = await loadSubmissionContext(token);
    if ('error' in ctx) {
      return { success: false, error: ctx.error };
    }
    const { client, adminClient, user, invite, exhibition, artistName } = ctx;

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

    const newInBatch = artworks.filter((a) => !a.existingCoaId).length;
    const limitError = checkSubmissionLimit(invite, newInBatch, batch.totalArtworkCount);
    if (limitError) {
      return { success: false, error: limitError };
    }

    const createdCoaIds: string[] = [];
    let batchFirstCoaId = '';

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

      const { data: coaArtwork, error: coaError } = await asUntyped(adminClient)
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

      await insertSubmittedArtwork(ctx, coaId);

      for (const extraImage of extraImages) {
        try {
          await uploadExtraAttachment(adminClient, user.id, coaId, extraImage);
        } catch (attachmentErr) {
          console.error('[Exhibitions] extra attachment failed (non-fatal)', attachmentErr, {
            coaId,
          });
        }
      }

      console.log('[Exhibitions] submitExhibitionArtwork artwork submitted', {
        batchIndex: batch.batchIndex + 1,
        index,
        coaId,
      });
    }


    const sessionFirstCoaId = batch.sessionFirstCoaId || batchFirstCoaId;
    const sessionFirstCosId = batch.sessionFirstCosId;

    await incrementSubmittedCount(adminClient, invite, newInBatch);

    if (batch.finalize) {
      const totalCount =
        batch.totalArtworkCount > 0 ? batch.totalArtworkCount : artworks.length;
      await finalizeInviteSubmission(ctx, {
        totalCount,
        firstTitle: artworks.find((a) => !a.existingCoaId)?.title ?? 'Artwork',
        sessionFirstCoaId,
        sessionFirstCosId,
      });
    }

    revalidatePath(`/exhibitions/${invite.exhibition_id}`);
    revalidatePath(`/exhibitions/${invite.exhibition_id}/edit`);
    revalidatePath('/artworks/my');

    for (const coaId of createdCoaIds) {
      revalidatePath(`/artworks/${coaId}/certificate`);
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
      cosArtworkId: sessionFirstCosId,
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
  const client = asUntyped(getSupabaseServerClient());
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
