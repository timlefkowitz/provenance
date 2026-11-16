import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { createNotification } from '~/lib/notifications';
import { sendNotificationEmail } from '~/lib/email';
import { logger } from '~/lib/logger';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { cosApprovingArtistId } from './cos-approval';

type Admin = ReturnType<typeof asUntyped>;

/** Change-request fields offered to the CoA, by column name. */
export type CosChangesForCoa = Record<string, string | null | undefined>;

const FIELD_LABELS: Record<string, string> = {
  image_url: 'photo',
  title: 'title',
  description: 'description',
  artist_name: 'artist name',
  medium: 'medium',
  creation_date: 'date',
  dimensions: 'dimensions',
  edition: 'edition',
  production_location: 'place made',
  former_owners: 'former owners',
  auction_history: 'auction history',
  exhibition_history: 'exhibition history',
  historic_context: 'historic context',
  celebrity_notes: 'notes',
};

/**
 * Fields a Certificate of Show's holder can offer the artist's CoA. Value,
 * ownership and sale details stay the show's own.
 */
const OFFERABLE = new Set([...Object.keys(FIELD_LABELS), 'original_image_url']);

/** The artist's Certificate of Authenticity a Certificate of Show was issued from. */
export async function findSourceCoaId(artworkId: string, admin?: Admin): Promise<string | null> {
  const db = admin ?? asUntyped(getSupabaseServerAdminClient());
  let current: string | null = artworkId;
  for (let i = 0; i < 16 && current; i++) {
    const { data }: { data: { source_artwork_id: string | null } | null } = await db
      .from('artworks')
      .select('source_artwork_id')
      .eq('id', current)
      .maybeSingle();
    const parentId: string | null = data?.source_artwork_id ?? null;
    if (!parentId) return null;
    const { data: parent }: { data: { certificate_type: string | null } | null } = await db
      .from('artworks')
      .select('certificate_type')
      .eq('id', parentId)
      .maybeSingle();
    if ((parent?.certificate_type ?? CERTIFICATE_TYPES.AUTHENTICITY) === CERTIFICATE_TYPES.AUTHENTICITY) {
      return parentId;
    }
    current = parentId;
  }
  return null;
}

function same(column: string, a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => {
    const text = v === null || v === undefined ? '' : String(v).trim();
    return column === 'creation_date' ? text.slice(0, 10) : text;
  };
  return norm(a) === norm(b);
}

/**
 * After the holder's side edits a Certificate of Show (the edit is already
 * applied), offer the changed photo and details to the artist's CoA it was
 * issued from. The artist gets a change request on their CoA to accept or
 * decline, plus a notification and email. A later edit before they respond
 * is merged into the same pending request.
 *
 * Never throws: the CoS edit has already been saved.
 */
export async function offerCosChangesToCoa(params: {
  cos: {
    id: string;
    title: string | null;
    account_id: string | null;
    certificate_type: string | null;
    artist_account_id: string | null;
  };
  changes: CosChangesForCoa;
  editorId: string;
}): Promise<{ offered: boolean; artistName?: string | null }> {
  const { cos, editorId } = params;
  try {
    const artistId = cosApprovingArtistId(cos);
    if (!artistId || artistId === editorId) return { offered: false };

    const admin = asUntyped(getSupabaseServerAdminClient());
    const coaId = await findSourceCoaId(cos.id, admin);
    if (!coaId) {
      logger.warn('offer_cos_changes_source_coa_missing', { cosId: cos.id });
      return { offered: false };
    }

    const { data: coa } = await admin
      .from('artworks')
      .select('*')
      .eq('id', coaId)
      .maybeSingle();
    if (!coa) return { offered: false };
    const holderId = coa.account_id as string | null;
    if (!holderId || holderId === editorId) return { offered: false };

    // Only what differs from the artist's certificate.
    const fields: Record<string, string | null> = {};
    for (const [column, value] of Object.entries(params.changes)) {
      if (value === undefined || !OFFERABLE.has(column) || column === 'original_image_url') continue;
      if (same(column, value, coa[column])) continue;
      fields[column] = value === null ? '' : value;
      if (column === 'image_url') fields.original_image_url = params.changes.original_image_url ?? null;
    }
    if (Object.keys(fields).length === 0) return { offered: false };

    const { data: pending } = await admin
      .from('provenance_update_requests')
      .select('id, update_fields')
      .eq('artwork_id', coaId)
      .eq('requested_by', editorId)
      .eq('status', 'pending')
      .eq('request_type', 'provenance_update')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const [{ data: editor }, { data: artist }, { data: showLink }] = await Promise.all([
      admin.from('accounts').select('name').eq('id', editorId).maybeSingle(),
      admin.from('accounts').select('name').eq('id', holderId).maybeSingle(),
      admin
        .from('exhibition_artworks')
        .select('exhibition_id, exhibitions(title)')
        .eq('artwork_id', cos.id)
        .limit(1)
        .maybeSingle(),
    ]);
    const who = (editor?.name as string | undefined) || 'The gallery';
    const artistName = (artist?.name as string | null) ?? null;
    const exhibitionId = (showLink?.exhibition_id as string | undefined) ?? null;
    const showTitle =
      ((showLink?.exhibitions as { title?: string } | null)?.title as string | undefined) ?? null;
    const workTitle = (coa.title as string | null) || cos.title || 'your work';

    const allFields = { ...((pending?.update_fields as Record<string, unknown>) ?? {}), ...fields };
    const labels = Object.keys(allFields)
      .map((k) => FIELD_LABELS[k])
      .filter(Boolean);
    const message = `${who} updated the ${labels.join(', ')} on their Certificate of Show for "${workTitle}"${
      showTitle ? ` in "${showTitle}"` : ''
    }. Add these changes to your Certificate of Authenticity, or leave yours as it is.`;

    if (pending) {
      const { error } = await admin
        .from('provenance_update_requests')
        .update({ update_fields: allFields, request_message: message, updated_at: new Date().toISOString() })
        .eq('id', pending.id);
      if (error) {
        logger.error('offer_cos_changes_merge_failed', { cosId: cos.id, coaId, error });
        return { offered: false };
      }
      // Already told about this request; the merged one waits in their portal.
      return { offered: true, artistName };
    }

    const { error: insertError } = await admin.from('provenance_update_requests').insert({
      artwork_id: coaId,
      requested_by: editorId,
      update_fields: fields,
      request_message: message,
      status: 'pending',
      request_type: 'provenance_update',
    });
    if (insertError) {
      logger.error('offer_cos_changes_insert_failed', { cosId: cos.id, coaId, error: insertError });
      return { offered: false };
    }

    const title = `Certificate of Show updated: ${workTitle}`;
    try {
      await createNotification({
        userId: holderId,
        type: 'provenance_update_request',
        title,
        message,
        artworkId: coaId,
        relatedUserId: editorId,
        metadata: {
          source: 'cos_update',
          cos_artwork_id: cos.id,
          ...(exhibitionId ? { exhibition_id: exhibitionId, exhibition_title: showTitle } : {}),
        },
      });
    } catch (e) {
      logger.error('offer_cos_changes_notification_failed', { cosId: cos.id, coaId, error: e });
    }

    try {
      const { data: authUser } = await getSupabaseServerAdminClient().auth.admin.getUserById(holderId);
      const email = authUser?.user?.email;
      if (email) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
        await sendNotificationEmail(email, artistName ?? '', title, {
          title,
          body: message,
          ctaUrl: `${siteUrl}/portal`,
          ctaLabel: 'Review changes',
        });
      }
    } catch (e) {
      logger.error('offer_cos_changes_email_failed', { cosId: cos.id, coaId, error: e });
    }

    return { offered: true, artistName };
  } catch (error) {
    logger.error('offer_cos_changes_failed', { cosId: cos.id, error });
    return { offered: false };
  }
}
