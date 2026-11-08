'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import {
  loadRequestReviewer,
  type ArtworkForReview,
} from '~/lib/certificate-claims/request-reviewer';

export type ProvenanceUpdateRequest = {
  id: string;
  artwork_id: string;
  requested_by: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by: string | null;
  reviewed_at: string | null;
  update_fields: Record<string, unknown>;
  request_message: string | null;
  review_message: string | null;
  request_type: 'provenance_update' | 'ownership_request' | 'artist_claim';
  artwork: {
    id: string;
    title: string;
    image_url: string | null;
  };
  requester: {
    id: string;
    name: string;
  };
};

export async function getProvenanceUpdateRequestsForOwner(): Promise<ProvenanceUpdateRequest[]> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return [];
  }

  // Requests this user reviews: those on certificates they hold, plus changes
  // a holder proposed to a Certificate of Show issued from this artist's CoA.
  // Read with the service role (the artist can't see the COS's requests via
  // RLS); each row is kept only when this user is its reviewer.
  const adminClient = getSupabaseServerAdminClient();
  const admin = asUntyped(adminClient);
  const columns = `
      *,
      artworks!inner (
        id,
        title,
        image_url,
        account_id,
        certificate_type,
        artist_account_id,
        gallery_profile_id
      )
    `;
  const [heldResult, asArtistResult] = await Promise.all([
    admin
      .from('provenance_update_requests')
      .select(columns)
      .eq('status', 'pending')
      .eq('artworks.account_id', user.id)
      .order('requested_at', { ascending: false }),
    admin
      .from('provenance_update_requests')
      .select(columns)
      .eq('status', 'pending')
      .eq('request_type', 'provenance_update')
      .eq('artworks.certificate_type', CERTIFICATE_TYPES.SHOW)
      .eq('artworks.artist_account_id', user.id)
      .neq('artworks.account_id', user.id)
      .order('requested_at', { ascending: false }),
  ]);

  const error = heldResult.error ?? asArtistResult.error;
  const candidates = [...(heldResult.data ?? []), ...(asArtistResult.data ?? [])];
  const data: typeof candidates = [];
  for (const req of candidates) {
    const type = req.request_type ?? 'provenance_update';
    const reviewer =
      type === 'provenance_update'
        ? await loadRequestReviewer(adminClient, req.artworks as ArtworkForReview, req.requested_by)
        : req.artworks.account_id;
    if (reviewer === user.id && req.requested_by !== user.id) data.push(req);
  }
  data.sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)));

  // Get requester account info separately
  const requesterIds = [...new Set((data || []).map((req: any) => req.requested_by))];
  let requesters: Record<string, { id: string; name: string }> = {};

  if (requesterIds.length > 0) {
    const { data: accounts } = await client
      .from('accounts')
      .select('id, name')
      .in('id', requesterIds);

    if (accounts) {
      requesters = accounts.reduce((acc: any, account: any) => {
        acc[account.id] = account;
        return acc;
      }, {});
    }
  }

  if (error) {
    console.error('Error fetching provenance update requests:', error);
  }

  return (data || []).map((req: any) => {
    const requester = requesters[req.requested_by] || { id: req.requested_by, name: 'Unknown User' };
    return {
      id: req.id,
      artwork_id: req.artwork_id,
      requested_by: req.requested_by,
      requested_at: req.requested_at,
      status: req.status,
      reviewed_by: req.reviewed_by,
      reviewed_at: req.reviewed_at,
      update_fields: req.update_fields,
      request_message: req.request_message,
      review_message: req.review_message,
      request_type: req.request_type || 'provenance_update',
      artwork: {
        id: req.artworks?.id || req.artwork_id,
        title: req.artworks?.title || 'Unknown Artwork',
        image_url: req.artworks?.image_url || null,
      },
      requester: {
        id: requester.id,
        name: requester.name,
      },
    };
  });
}

