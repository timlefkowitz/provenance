'use server';

import { headers } from 'next/headers';

import { asUntyped } from '~/lib/supabase-untyped';
import { checkRateLimit } from '~/lib/rate-limit';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import type { SupabaseClient } from '@supabase/supabase-js';

import { captureCrmContacts } from '~/lib/crm/capture-contact';
import { getExhibitionTeamUserIds, getOpenShowsForArtwork } from '~/lib/exhibitions/exhibition-team';
import { createNotification } from '~/lib/notifications';

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

    // Visitors are signed out and each inquiry can notify a whole show team.
    const allowed = await checkRateLimit(
      { headers: await headers() },
      { keyPrefix: 'artwork-inquiry', maxPerWindow: 5, windowMs: 10 * 60_000 },
    );
    if (!allowed) {
      return { success: false, error: 'Too many inquiries. Please try again in a few minutes.' };
    }

    const admin = getSupabaseServerAdminClient();

    // The owner comes from the artwork itself: input.ownerAccountId is
    // client-supplied (and empty from the lightbox / quick view), so it must
    // not decide who receives the inquiry.
    const { data: artwork } = await asUntyped(admin)
      .from('artworks')
      .select('id, account_id, title')
      .eq('id', input.artworkId)
      .maybeSingle();

    if (!artwork?.account_id) {
      console.warn('[ArtworkInquiry] Artwork not found', { artworkId: input.artworkId });
      return { success: false, error: 'This artwork is no longer available.' };
    }
    const ownerAccountId = artwork.account_id as string;
    const artworkTitle = (artwork.title as string | null) || 'Untitled';

    const { error: insertError } = await asUntyped(admin)
      .from('artwork_inquiries')
      .insert({
        artwork_id: input.artworkId,
        owner_account_id: ownerAccountId,
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
      await captureCrmContacts(
        ownerAccountId,
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
    } catch (crmErr) {
      console.error('[ArtworkInquiry] CRM capture failed (non-fatal)', crmErr);
    }

    // Tell the holder, and — when the work is in a show that's up or coming
    // up — the curator and their team, so the show hears about every inquiry
    // and not only the artist.
    try {
      await notifyInquiryRecipients(admin, {
        artworkId: input.artworkId,
        artworkTitle,
        ownerAccountId,
        name,
      });
    } catch (notifyErr) {
      console.error('[ArtworkInquiry] notify failed (non-fatal)', notifyErr);
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

async function notifyInquiryRecipients(
  admin: SupabaseClient,
  args: { artworkId: string; artworkTitle: string; ownerAccountId: string; name: string },
) {
  const sends: Promise<unknown>[] = [
    createNotification({
      userId: args.ownerAccountId,
      type: 'artwork_inquiry',
      title: `New inquiry: ${args.artworkTitle}`,
      message: `${args.name} asked about this piece.`,
      artworkId: args.artworkId,
    }),
  ];
  const notified = new Set([args.ownerAccountId]);

  for (const show of await getOpenShowsForArtwork(admin, args.artworkId)) {
    for (const userId of await getExhibitionTeamUserIds(admin, show.gallery_id)) {
      if (notified.has(userId)) continue;
      notified.add(userId);
      sends.push(
        createNotification({
          userId,
          type: 'artwork_inquiry',
          title: `New inquiry: ${args.artworkTitle}`,
          message: `${args.name} asked about this piece from ${show.title}.`,
          artworkId: args.artworkId,
          metadata: { exhibition_id: show.id },
        }),
      );
    }
  }

  for (const r of await Promise.allSettled(sends)) {
    if (r.status === 'rejected') console.error('[ArtworkInquiry] notify failed', r.reason);
  }
}
