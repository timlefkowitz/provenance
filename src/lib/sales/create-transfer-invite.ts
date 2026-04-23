import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  buildOwnerInviteRows,
  commitCertificateInviteBatch,
} from '~/lib/certificate-claims/create-invite-batch';
import { logger } from '~/lib/logger';

export interface CreateArtworkTransferInviteParams {
  artworkId: string;
  sellerUserId: string;
  buyerEmail: string | null;
  buyerAccountId: string | null;
  workTitle: string;
}

export interface CreateArtworkTransferInviteResult {
  sent: number;
  token: string | null;
  errors: string[];
}

async function lookupEmailForAccount(accountId: string): Promise<string | null> {
  const admin = getSupabaseServerAdminClient();
  try {
    const { data: acct } = await (admin as any)
      .from('accounts')
      .select('email')
      .eq('id', accountId)
      .maybeSingle();
    if (acct?.email && typeof acct.email === 'string') {
      return acct.email;
    }
  } catch (err) {
    console.error('[Sales] lookupEmailForAccount accounts failed', err);
  }
  try {
    const { data: profile } = await (admin as any)
      .from('user_profiles')
      .select('email')
      .eq('user_id', accountId)
      .maybeSingle();
    if (profile?.email && typeof profile.email === 'string') {
      return profile.email;
    }
  } catch (err) {
    console.error('[Sales] lookupEmailForAccount user_profiles failed', err);
  }
  return null;
}

/**
 * When an artwork is marked as sold and a buyer is identified (either by
 * account or email), create an ownership-claim invite so the buyer can accept
 * the transfer into their own collection. Reuses the existing certificate
 * claim / invite pattern.
 *
 * Best-effort: failures are logged and returned as errors but do not throw,
 * because the sale record itself must remain successful even if the invite
 * step fails.
 */
export async function createArtworkTransferInvite(
  params: CreateArtworkTransferInviteParams,
): Promise<CreateArtworkTransferInviteResult> {
  const { artworkId, sellerUserId, buyerAccountId, workTitle } = params;
  let buyerEmail = params.buyerEmail;

  console.log('[Sales] createArtworkTransferInvite started', {
    artworkId,
    hasBuyerAccount: !!buyerAccountId,
    hasEmail: !!buyerEmail,
  });

  if (!buyerEmail && buyerAccountId) {
    buyerEmail = await lookupEmailForAccount(buyerAccountId);
  }

  if (!buyerEmail) {
    console.log('[Sales] createArtworkTransferInvite skipped — no email', { artworkId });
    return {
      sent: 0,
      token: null,
      errors: ['No email available to send the ownership transfer invite'],
    };
  }

  try {
    const client = getSupabaseServerClient();
    const admin = getSupabaseServerAdminClient();

    const { rows, titles, errors: buildErrors } = await buildOwnerInviteRows(
      client,
      admin,
      sellerUserId,
      [artworkId],
      buyerEmail,
    );

    if (rows.length === 0) {
      console.log('[Sales] createArtworkTransferInvite no invite rows', {
        artworkId,
        buildErrors,
      });
      return { sent: 0, token: null, errors: buildErrors };
    }

    const result = await commitCertificateInviteBatch({
      userId: sellerUserId,
      inviteeEmail: buyerEmail,
      rows,
      email: {
        variant: 'owner',
        artworkTitles: titles.length ? titles : [workTitle],
      },
      createdByUserId: sellerUserId,
      enforceOwnerRateLimit: true,
    });

    console.log('[Sales] createArtworkTransferInvite complete', {
      artworkId,
      sent: result.sent,
      errors: result.errors,
    });

    return {
      sent: result.sent,
      token: result.token,
      errors: [...buildErrors, ...result.errors],
    };
  } catch (err) {
    console.error('[Sales] createArtworkTransferInvite failed', err);
    logger.error('create_artwork_transfer_invite_failed', { artworkId, error: err });
    return {
      sent: 0,
      token: null,
      errors: [(err as Error).message || 'Failed to create ownership transfer invite'],
    };
  }
}
