'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { asUntyped } from '~/lib/supabase-untyped';
import { parsePersonValue } from '~/lib/people/parse-person-value';
import { batchSendArtistClaimInvites } from '~/app/artworks/edit-provenance/_actions/batch-send-artist-claim-invites';
import { batchSendCollectorInvites } from '~/app/artworks/edit-provenance/_actions/batch-send-collector-invites';

export type InvitePeopleResult = {
  artist?: { sent: number; errors: string[] };
  owner?: { sent: number; errors: string[] };
};

async function emailForAccount(accountId: string): Promise<string | null> {
  const { data } = await asUntyped(getSupabaseServerAdminClient())
    .from('accounts')
    .select('email')
    .eq('id', accountId)
    .maybeSingle();
  return (data?.email as string | null) ?? null;
}

/**
 * After works are posted or edited: invite a new artist (by the email typed in
 * the artist field) to claim them, and invite the named owner to accept a
 * linked Certificate of Ownership. One email each for the whole batch.
 *
 * - Artist invites go only to someone added as new with an email; artists
 *   already on Provenance are linked directly and see the works to claim.
 * - Owner invites go to a picked account (email looked up server-side, never
 *   sent to the browser) or a typed email. Skipped when the owner is the
 *   poster.
 */
export async function invitePeopleForArtworks(params: {
  artworkIds: string[];
  artist?: unknown;
  owner?: unknown;
}): Promise<InvitePeopleResult> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || params.artworkIds.length === 0) return {};

  const result: InvitePeopleResult = {};
  const artist = parsePersonValue(params.artist);
  const owner = parsePersonValue(params.owner);

  if (artist?.isNew && artist.email) {
    result.artist = await batchSendArtistClaimInvites(params.artworkIds, artist.email);
  }

  if (owner && owner.accountId !== user.id) {
    const email = owner.accountId ? await emailForAccount(owner.accountId) : owner.email ?? null;
    if (email && email.toLowerCase() !== user.email?.toLowerCase()) {
      result.owner = await batchSendCollectorInvites(
        params.artworkIds,
        email,
        owner.name || undefined,
      );
    }
  }

  console.log('[People] invitePeopleForArtworks', {
    count: params.artworkIds.length,
    artistInvites: result.artist?.sent ?? 0,
    ownerInvites: result.owner?.sent ?? 0,
  });
  return result;
}
