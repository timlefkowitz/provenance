'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';
import { normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import { captureCrmContacts } from '~/lib/crm/capture-contact';
import { sendCertificateInviteEmail, type CertificateRecipientRole } from '~/lib/email';
import { logger } from '~/lib/logger';

const RECIPIENT_ROLES: CertificateRecipientRole[] = ['artist', 'collector', 'gallery'];
const MAX_MESSAGE_LENGTH = 1000;

export type SendCertificateResult = { success: true } | { success: false; error: string };

/**
 * Emails a link to this certificate to an artist, collector or gallery.
 * Limited to the certificate owner and its gallery team so the share email
 * can't be used to send mail on behalf of certificates you don't manage.
 */
export async function sendCertificate(input: {
  artworkId: string;
  recipientRole: CertificateRecipientRole;
  email: string;
  name?: string;
  message?: string;
}): Promise<SendCertificateResult> {
  const { artworkId, recipientRole } = input;
  console.log('[Certificates] sendCertificate started', { artworkId, recipientRole });
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in' };
    }

    if (!RECIPIENT_ROLES.includes(recipientRole)) {
      return { success: false, error: 'Choose who you are sending to' };
    }

    const toEmail = normalizeInviteEmail(input.email);
    if (!toEmail || !toEmail.includes('@')) {
      return { success: false, error: 'Enter a valid email address' };
    }

    const message = input.message?.trim() || null;
    if (message && message.length > MAX_MESSAGE_LENGTH) {
      return { success: false, error: `Message must be under ${MAX_MESSAGE_LENGTH} characters` };
    }

    const { data: artwork, error: artworkError } = await asUntyped(client)
      .from('artworks')
      .select('id, title, artist_name, account_id, gallery_profile_id')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      console.error('[Certificates] sendCertificate artwork lookup failed', artworkError);
      return { success: false, error: 'Certificate not found' };
    }

    const canSend = await canEditGalleryArtworks(user.id, {
      account_id: artwork.account_id,
      gallery_profile_id: artwork.gallery_profile_id ?? undefined,
    });
    if (!canSend) {
      return { success: false, error: 'Only the certificate owner can send this certificate' };
    }

    const { data: account } = await asUntyped(client)
      .from('accounts')
      .select('name')
      .eq('id', user.id)
      .single();

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
    const name = input.name?.trim() || null;

    try {
      await sendCertificateInviteEmail(
        toEmail,
        {
          senderName: account?.name || user.email || 'Someone',
          artworkTitle: artwork.title || 'Untitled',
          artistName: artwork.artist_name,
          certificateUrl: `${siteUrl}/artworks/${artworkId}/certificate`,
          personalMessage: message,
          recipientRole,
          recipientName: name,
        },
        { strict: true },
      );
    } catch (emailError) {
      console.error('[Certificates] sendCertificate email failed', emailError);
      logger.error('send_certificate_email_failed', { artworkId, userId: user.id, error: emailError });
      const reason = emailError instanceof Error ? emailError.message : 'unknown error';
      return { success: false, error: `Email to ${toEmail} was not delivered: ${reason}` };
    }

    await captureCrmContacts(user.id, [
      {
        email: toEmail,
        name,
        source: 'certificate',
        artworkId,
        notes: `Certificate sent to ${recipientRole} — ${artwork.title || 'Untitled'}`,
      },
    ]);

    console.log('[Certificates] sendCertificate success', { artworkId, recipientRole });
    return { success: true };
  } catch (error) {
    console.error('[Certificates] sendCertificate failed', error);
    logger.error('send_certificate_failed', { artworkId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send certificate',
    };
  }
}
