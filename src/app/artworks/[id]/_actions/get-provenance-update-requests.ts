'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type ProvenanceUpdateRequest = {
  id: string;
  artwork_id: string;
  requested_by: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by: string | null;
  reviewed_at: string | null;
  update_fields: Record<string, any>;
  request_message: string | null;
  review_message: string | null;
  request_type: 'provenance_update' | 'ownership_request';
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

  // First get artworks owned by this user
  const { data: ownedArtworks } = await (client as any)
    .from('artworks')
    .select('id')
    .eq('account_id', user.id);

  if (!ownedArtworks || ownedArtworks.length === 0) {
    return [];
  }

  const ownedArtworkIds = ownedArtworks.map((a: any) => a.id);

  // Get all pending requests for those artworks
  const { data, error } = await (client as any)
    .from('provenance_update_requests')
    .select(`
      *,
      artworks (
        id,
        title,
        image_url
      )
    `)
    .in('artwork_id', ownedArtworkIds)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });

  if (error) {
    console.error('Error fetching provenance update requests:', error);
    return [];
  }

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
    return [];
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

