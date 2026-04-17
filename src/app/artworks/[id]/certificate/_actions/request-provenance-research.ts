'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canManageGallery } from '~/app/profiles/_actions/gallery-members';
import { sendNotificationEmail } from '~/lib/email';
import { createNotification } from '~/lib/notifications';
import { getPublicSiteOrigin } from '~/lib/seo/public-site-origin';
import { CERTIFICATE_TYPES, getCertificateTypeLabel } from '~/lib/user-roles';

export type RequestProvenanceResearchResult =
  | { success: true }
  | { success: false; error: string };

const REQUESTABLE_TYPES = new Set([
  CERTIFICATE_TYPES.OWNERSHIP,
  CERTIFICATE_TYPES.SHOW,
  'collection',
]);

function isRequestableCertificateType(t: string | null | undefined): boolean {
  if (!t) return false;
  return REQUESTABLE_TYPES.has(t);
}

/**
 * Owner (or gallery manager for Certificate of Show) requests institutional provenance research.
 * Notifies all admin accounts and emails the admin team when Resend is configured.
 */
export async function requestProvenanceResearch(
  artworkId: string,
): Promise<RequestProvenanceResearchResult> {
  console.log('[ProvenanceRequest] requestProvenanceResearch started', { artworkId });

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      console.log('[ProvenanceRequest] rejected: not authenticated');
      return { success: false, error: 'Sign in to request provenance research.' };
    }

    const { data: requesterAccount } = await client
      .from('accounts')
      .select('id, name, email')
      .eq('id', user.id)
      .single();

    const { data: artwork, error: artworkError } = await client
      .from('artworks')
      .select(
        'id, account_id, title, certificate_number, certificate_type, gallery_profile_id, status',
      )
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      console.error('[ProvenanceRequest] artwork not found', artworkError);
      return { success: false, error: 'Artwork not found.' };
    }

    const certType = artwork.certificate_type as string | null;
    if (!isRequestableCertificateType(certType)) {
      console.log('[ProvenanceRequest] wrong certificate type', { certType });
      return {
        success: false,
        error: 'Provenance requests are only available for certificates of ownership or show.',
      };
    }

    const isOwner = artwork.account_id === user.id;
    let canManageAsGallery = false;
    if (certType === CERTIFICATE_TYPES.SHOW && artwork.gallery_profile_id) {
      canManageAsGallery = await canManageGallery(user.id, artwork.gallery_profile_id);
    }

    if (!isOwner && !canManageAsGallery) {
      console.log('[ProvenanceRequest] forbidden: not owner or gallery manager', {
        userId: user.id,
      });
      return {
        success: false,
        error: 'Only the certificate owner or gallery managers can request provenance research.',
      };
    }

    let adminClient: ReturnType<typeof getSupabaseServerAdminClient>;
    try {
      adminClient = getSupabaseServerAdminClient();
    } catch (err) {
      console.error('[ProvenanceRequest] admin client unavailable', err);
      return {
        success: false,
        error: 'Request could not be sent. Please try again later or contact support.',
      };
    }

    const { count: existingCount, error: dupError } = await adminClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('artwork_id', artworkId)
      .eq('type', 'provenance_service_request')
      .eq('related_user_id', user.id);

    if (dupError) {
      console.error('[ProvenanceRequest] duplicate check failed', dupError);
      return {
        success: false,
        error: 'Could not verify prior requests. Please try again in a moment.',
      };
    }
    if ((existingCount ?? 0) > 0) {
      console.log('[ProvenanceRequest] duplicate request blocked', { artworkId, userId: user.id });
      return {
        success: false,
        error: 'A provenance research request for this work is already on file.',
      };
    }

    const { data: adminRows, error: adminError } = await adminClient
      .from('accounts')
      .select('id, email, name, public_data')
      .contains('public_data', { admin: true } as Record<string, unknown>);

    if (adminError) {
      console.error('[ProvenanceRequest] failed to list admins', adminError);
      return { success: false, error: 'Could not reach the admin team. Please try again later.' };
    }

    const admins = (adminRows ?? []).filter((row) => {
      const pd = row.public_data as Record<string, unknown> | null;
      return pd?.admin === true;
    });

    if (admins.length === 0) {
      console.error('[ProvenanceRequest] no admin accounts configured');
      return {
        success: false,
        error: 'Provenance requests are not available right now. Please contact support.',
      };
    }

    const artworkTitle = artwork.title || 'Untitled artwork';
    const certLabel = getCertificateTypeLabel(certType || CERTIFICATE_TYPES.OWNERSHIP);
    const requesterName = requesterAccount?.name || 'A collector';
    const origin = getPublicSiteOrigin();
    const certificateUrl = new URL(`/artworks/${artwork.id}/certificate`, origin).href;

    const notificationTitle = `Provenance research requested: ${artworkTitle}`;
    const notificationMessage = `${requesterName} requested provenance research for ${certLabel} #${artwork.certificate_number}.`;

    for (const admin of admins) {
      try {
        await createNotification({
          userId: admin.id,
          type: 'provenance_service_request',
          title: notificationTitle,
          message: notificationMessage,
          artworkId: artwork.id,
          relatedUserId: user.id,
          metadata: {
            certificate_type: certType,
            certificate_number: artwork.certificate_number,
            requester_name: requesterName,
          },
        });
      } catch (notifErr) {
        console.error('[ProvenanceRequest] createNotification failed for admin', admin.id, notifErr);
      }

      const to = admin.email?.trim();
      if (to) {
        try {
          await sendNotificationEmail(to, admin.name || 'Provenance admin', notificationTitle, {
            title: notificationTitle,
            body: `${notificationMessage}\n\nRequester: ${requesterName}${requesterAccount?.email ? ` (${requesterAccount.email})` : ''}`,
            ctaUrl: certificateUrl,
            ctaLabel: 'View certificate',
          });
        } catch (emailErr) {
          console.error('[ProvenanceRequest] admin email failed', to, emailErr);
        }
      }
    }

    console.log('[ProvenanceRequest] completed', {
      artworkId,
      adminCount: admins.length,
    });

    revalidatePath(`/artworks/${artworkId}/certificate`);
    revalidatePath('/notifications');

    return { success: true };
  } catch (err) {
    console.error('[ProvenanceRequest] requestProvenanceResearch failed', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
    };
  }
}
