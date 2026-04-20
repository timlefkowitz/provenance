import { sendNotificationEmail } from '~/lib/email';
import { getCertificateClaimUrl } from '~/lib/certificate-claims/site-url';

export async function sendGalleryCoSInviteEmail(params: {
  to: string;
  recipientName: string;
  artworkTitle: string;
  artistName?: string;
  recipientRole: 'gallery' | 'institution';
  token: string;
}): Promise<void> {
  const { to, recipientName, artworkTitle, artistName, recipientRole, token } = params;
  const claimUrl = getCertificateClaimUrl(token);
  const roleLabel = recipientRole === 'institution' ? 'institution' : 'gallery';
  const artistLine = artistName ? ` by ${artistName}` : '';
  console.log('[Certificates] sendGalleryCoSInviteEmail', { to, artworkTitle, recipientRole });
  await sendNotificationEmail(
    to,
    recipientName,
    `Create Certificate of Show — ${artworkTitle}`,
    {
      title: `Create a Certificate of Show`,
      body: `An artist has invited your ${roleLabel} to issue a Certificate of Show for "${artworkTitle}"${artistLine}. Sign in with this email address and accept to create the certificate — it will be automatically linked to the artist's provenance record.`,
      ctaUrl: claimUrl,
      ctaLabel: 'Create Certificate of Show',
    },
  );
}

export async function sendOwnerCoownershipInviteEmail(params: {
  to: string;
  recipientName: string;
  artworkTitle: string;
  token: string;
}): Promise<void> {
  const { to, recipientName, artworkTitle, token } = params;
  const claimUrl = getCertificateClaimUrl(token);
  console.log('[Certificates] sendOwnerCoownershipInviteEmail', { to, artworkTitle });
  await sendNotificationEmail(
    to,
    recipientName,
    `Claim your Certificate of Ownership — ${artworkTitle}`,
    {
      title: 'Claim your certificate of ownership',
      body: `You have been invited to claim a Certificate of Ownership for "${artworkTitle}" linked to the artist's Certificate of Authenticity. Click below to sign in (use this email) and complete your claim.`,
      ctaUrl: claimUrl,
      ctaLabel: 'Claim certificate',
    },
  );
}

export async function sendArtistCoaInviteEmail(params: {
  to: string;
  recipientName: string;
  artworkTitle: string;
  token: string;
  senderName?: string;
}): Promise<void> {
  const { to, recipientName, artworkTitle, token, senderName } = params;
  const claimUrl = getCertificateClaimUrl(token);
  const fromLine = senderName ? ` from ${senderName}` : '';
  console.log('[Certificates] sendArtistCoaInviteEmail', { to, artworkTitle, senderName });
  await sendNotificationEmail(
    to,
    recipientName,
    `Complete your Certificate of Authenticity — ${artworkTitle}`,
    {
      title: 'Complete your Certificate of Authenticity',
      body: `You have been invited${fromLine} to complete your Certificate of Authenticity for "${artworkTitle}". Sign in with this email address to complete your certificate — it will be automatically linked to the existing provenance record.`,
      ctaUrl: claimUrl,
      ctaLabel: 'Complete certificate',
    },
  );
}
