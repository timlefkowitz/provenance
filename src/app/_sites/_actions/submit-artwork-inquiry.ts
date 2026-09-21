'use server';

import { asUntyped } from '~/lib/supabase-untyped';
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

    const { error: insertError } = await asUntyped(admin)
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
      // Visitors have no session, so capture runs with the admin client. Take the owner
      // from the artwork itself: input.ownerAccountId is client-supplied and must not
      // decide whose mailing list receives a contact.
      const { data: artwork } = await asUntyped(admin)
        .from('artworks')
        .select('account_id')
        .eq('id', input.artworkId)
        .maybeSingle();

      if (artwork?.account_id) {
        await captureCrmContacts(
          artwork.account_id as string,
          [
            {
              name,
              email,
              notes: message ?? undefined,
              source: 'site_inquiry',
              artworkId: input.artworkId,
            },
          ],
          { client: asUntyped(admin) },
        );
      } else {
        console.warn('[ArtworkInquiry] CRM capture skipped — artwork not found', {
          artworkId: input.artworkId,
        });
      }
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
