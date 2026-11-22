import 'server-only';

import { insertLinkedCertificateOfOwnershipFromCoa } from '~/lib/certificate-claims/insert-linked-certificate';
import { logger } from '~/lib/logger';
import { createNotification } from '~/lib/notifications';
import { createArtworkTransferInvite } from '~/lib/sales/create-transfer-invite';
import { ensureSaleForAcceptedOwnership } from '~/lib/sales/record-sale';
import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';

export type DeliverOwnershipResult =
  | { kind: 'issued'; artworkId: string }
  | { kind: 'invited' }
  | { kind: 'skipped'; reason: string };

/**
 * After an online sale, give the buyer their Certificate of Ownership.
 *
 * Signed-in buyer: the certificate is created straight in their collection
 * (the same certificate a claim would create). Guest: they get the usual
 * claim email, and accept it once they sign in. Safe to run twice.
 */
export async function deliverOwnershipFromSale(
  admin: UntypedSupabaseClient,
  params: {
    /** The certificate the sale was recorded on (the artist's COA or the show's COS). */
    saleArtworkId: string;
    buyerAccountId: string | null;
    buyerEmail: string | null;
    buyerName: string | null;
    reference: string;
  },
): Promise<DeliverOwnershipResult> {
  const db = asUntyped(admin);
  const { data: source } = await db.from('artworks').select('*').eq('id', params.saleArtworkId).maybeSingle();
  if (!source) return { kind: 'skipped', reason: 'certificate not found' };
  if (
    source.certificate_type !== CERTIFICATE_TYPES.AUTHENTICITY &&
    source.certificate_type !== CERTIFICATE_TYPES.SHOW
  ) {
    // e.g. a collector reselling from their own CoO: no linked CoO can be issued from it.
    console.log('[Ownership] sale certificate cannot issue a CoO', {
      artworkId: params.saleArtworkId,
      type: source.certificate_type,
    });
    return { kind: 'skipped', reason: 'not a CoA or CoS' };
  }

  if (params.buyerAccountId) {
    const { data: existing } = await db
      .from('artworks')
      .select('id')
      .eq('source_artwork_id', params.saleArtworkId)
      .eq('account_id', params.buyerAccountId)
      .eq('certificate_type', CERTIFICATE_TYPES.OWNERSHIP)
      .limit(1)
      .maybeSingle();
    if (existing) return { kind: 'issued', artworkId: existing.id as string };

    const { id: newId } = await insertLinkedCertificateOfOwnershipFromCoa(admin, source, {
      ownerAccountId: params.buyerAccountId,
      createdByUserId: params.buyerAccountId,
    });

    try {
      await ensureSaleForAcceptedOwnership(admin, {
        sourceArtworkId: params.saleArtworkId,
        buyerAccountId: params.buyerAccountId,
        buyerEmail: params.buyerEmail,
        buyerName: params.buyerName || 'Collector',
        inviteId: params.reference,
      });
    } catch (err) {
      logger.error('deliver_ownership_link_sale_failed', { artworkId: params.saleArtworkId, error: err });
    }

    const title = (source.title as string) || 'your artwork';
    await Promise.all([
      createNotification({
        userId: params.buyerAccountId,
        type: 'certificate_claimed',
        title: `Your Certificate of Ownership: ${title}`,
        message: `Thank you for your purchase. "${title}" is now in your collection.`,
        artworkId: newId,
      }).catch((e: unknown) => logger.error('deliver_ownership_notify_buyer_failed', { error: e })),
      createNotification({
        userId: source.account_id as string,
        type: 'certificate_claimed',
        title: `Certificate of Ownership issued: ${title}`,
        message: `The buyer of "${title}" now holds its Certificate of Ownership.`,
        artworkId: newId,
        relatedUserId: params.buyerAccountId,
      }).catch((e: unknown) => logger.error('deliver_ownership_notify_seller_failed', { error: e })),
    ]);

    console.log('[Ownership] CoO issued to signed-in buyer', { source: params.saleArtworkId, coo: newId });
    return { kind: 'issued', artworkId: newId };
  }

  if (!params.buyerEmail) return { kind: 'skipped', reason: 'no buyer email' };
  const invite = await createArtworkTransferInvite({
    artworkId: params.saleArtworkId,
    sellerUserId: source.account_id as string,
    sellerAccountId: source.account_id as string,
    buyerEmail: params.buyerEmail,
    buyerAccountId: null,
    buyerName: params.buyerName,
    workTitle: (source.title as string) || 'Untitled',
  });
  if (invite.sent > 0) {
    console.log('[Ownership] CoO claim invite sent to guest buyer', { source: params.saleArtworkId });
    return { kind: 'invited' };
  }
  console.error('[Ownership] CoO invite not sent', { source: params.saleArtworkId, errors: invite.errors });
  return { kind: 'skipped', reason: invite.errors.join('; ') || 'invite not sent' };
}
