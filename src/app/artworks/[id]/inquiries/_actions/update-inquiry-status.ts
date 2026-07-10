'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

const ALLOWED_STATUSES = ['pending', 'contacted', 'sold', 'closed'] as const;
type InquiryStatus = (typeof ALLOWED_STATUSES)[number];

export async function updateInquiryStatus(
  inquiryId: string,
  artworkId: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  console.log('[ArtworkInquiry] updateInquiryStatus started', { inquiryId, status });
  try {
    if (!ALLOWED_STATUSES.includes(status as InquiryStatus)) {
      return { ok: false, error: 'Invalid status' };
    }

    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return { ok: false, error: 'Unauthorized' };
    }

    const { error } = await asUntyped(client)
      .from('artwork_inquiries')
      .update({ status })
      .eq('id', inquiryId)
      .eq('owner_account_id', user.id);

    if (error) {
      console.error('[ArtworkInquiry] updateInquiryStatus failed', error);
      return { ok: false, error: error.message };
    }

    revalidatePath(`/artworks/${artworkId}/inquiries`);
    console.log('[ArtworkInquiry] Status updated', { inquiryId, status });
    return { ok: true };
  } catch (err) {
    console.error('[ArtworkInquiry] updateInquiryStatus threw', err);
    return { ok: false, error: 'Something went wrong' };
  }
}
