'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { captureCrmContacts } from '~/lib/crm/capture-contact';

export type SubmitArtworkInquiryInput = {
  artworkId: string;
  ownerAccountId: string;
  name: string;
  email: string;
  message?: string;
};

export type SubmitArtworkInquiryResult =
  | { success: true }
  | { success: false; error: string };

export async function submitArtworkInquiry(
  input: SubmitArtworkInquiryInput,
): Promise<SubmitArtworkInquiryResult> {
  console.log('[ArtworkInquiry] submitArtworkInquiry started', {
    artworkId: input.artworkId,
    ownerAccountId: input.ownerAccountId,
  });

  try {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    const message = input.message?.trim() || null;

    if (!name) {
      return { success: false, error: 'Name is required' };
    }
    if (!email || !email.includes('@')) {
      return { success: false, error: 'A valid email address is required' };
    }

    const admin = getSupabaseServerAdminClient();

    const { error: insertError } = await (admin as any)
      .from('artwork_inquiries')
      .insert({
        artwork_id: input.artworkId,
        owner_account_id: input.ownerAccountId,
        name,
        email,
        message,
        inquiry_type: 'inquire',
        status: 'pending',
      });

    if (insertError) {
      console.error('[ArtworkInquiry] DB insert failed', insertError);
      return { success: false, error: 'Failed to submit inquiry. Please try again.' };
    }

    // Capture lead into owner's CRM (best-effort; do not block on failure)
    try {
      await captureCrmContacts(input.ownerAccountId, [
        {
          name,
          email,
          notes: message ?? undefined,
          source: 'site_inquiry',
        },
      ]);
    } catch (crmErr) {
      console.error('[ArtworkInquiry] CRM capture failed (non-fatal)', crmErr);
    }

    console.log('[ArtworkInquiry] Inquiry submitted successfully', {
      artworkId: input.artworkId,
    });
    return { success: true };
  } catch (err) {
    console.error('[ArtworkInquiry] submitArtworkInquiry failed', err);
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}
