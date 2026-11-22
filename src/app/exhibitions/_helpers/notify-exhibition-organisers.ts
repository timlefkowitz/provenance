import 'server-only';

import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { createNotification, type NotificationType } from '~/lib/notifications';
import { sendNotificationEmail } from '~/lib/email';

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
}

/**
 * Tells the account that owns a show (the gallery or institution) about
 * something an invited artist did, with a link to the show's edit page.
 * Same recipient as artwork-submission notices. Failures are logged only.
 */
export async function notifyExhibitionOrganisers(
  admin: UntypedSupabaseClient,
  params: {
    exhibition: { id: string; gallery_id: string; title: string };
    actorUserId: string;
    type: NotificationType;
    title: string;
    message: string;
    /** Also email the organiser (for things they need to act on). */
    email: boolean;
    emailSubject?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { exhibition, actorUserId } = params;
  if (exhibition.gallery_id === actorUserId) return;
  const actionPath = `/exhibitions/${exhibition.id}/edit#artist-requests`;

  try {
    await createNotification({
      userId: exhibition.gallery_id,
      type: params.type,
      title: params.title,
      message: params.message,
      relatedUserId: actorUserId,
      metadata: {
        exhibition_id: exhibition.id,
        action_path: actionPath,
        action_label: 'Open exhibition',
        ...params.metadata,
      },
    });
  } catch (err) {
    console.error('[Exhibitions] organiser notification failed', { type: params.type, err });
  }

  if (!params.email) return;
  try {
    const { data: account } = await admin
      .from('accounts')
      .select('name, email')
      .eq('id', exhibition.gallery_id)
      .maybeSingle();
    const to = (account?.email as string | null) ?? null;
    if (!to) return;
    await sendNotificationEmail(to, (account?.name as string | null) ?? 'there', params.emailSubject ?? params.title, {
      title: params.title,
      body: params.message,
      ctaUrl: `${siteUrl()}${actionPath}`,
      ctaLabel: 'Review the request',
    });
  } catch (err) {
    console.error('[Exhibitions] organiser email failed', { type: params.type, err });
  }
}

/** Tells an invited artist the organiser answered their change request. */
export async function notifyArtistOfChangeResponse(
  admin: UntypedSupabaseClient,
  params: {
    artistUserId: string;
    actorUserId: string;
    exhibitionId: string;
    title: string;
    message: string;
  },
): Promise<void> {
  const actionPath = `/exhibitions/${params.exhibitionId}/artist`;
  try {
    await createNotification({
      userId: params.artistUserId,
      type: 'exhibition_change_resolved',
      title: params.title,
      message: params.message,
      relatedUserId: params.actorUserId,
      metadata: {
        exhibition_id: params.exhibitionId,
        action_path: actionPath,
        action_label: 'Open your show',
      },
    });
  } catch (err) {
    console.error('[Exhibitions] artist change-response notification failed', err);
  }

  try {
    const { data } = await admin.auth.admin.getUserById(params.artistUserId);
    const to = data?.user?.email;
    if (!to) return;
    const { data: account } = await admin
      .from('accounts')
      .select('name')
      .eq('id', params.artistUserId)
      .maybeSingle();
    await sendNotificationEmail(to, (account?.name as string | null) ?? 'there', params.title, {
      title: params.title,
      body: params.message,
      ctaUrl: `${siteUrl()}${actionPath}`,
      ctaLabel: 'Open your show',
    });
  } catch (err) {
    console.error('[Exhibitions] artist change-response email failed', err);
  }
}
