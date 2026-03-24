import { sendNotificationEmail } from '~/lib/email';
import { getCertificateClaimUrl } from '~/lib/certificate-claims/site-url';

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
}): Promise<void> {
  const { to, recipientName, artworkTitle, token } = params;
  const claimUrl = getCertificateClaimUrl(token);
  console.log('[Certificates] sendArtistCoaInviteEmail', { to, artworkTitle });
  await sendNotificationEmail(
    to,
    recipientName,
    `Complete your Certificate of Authenticity — ${artworkTitle}`,
    {
      title: 'Complete your certificate of authenticity',
      body: `Your claim as artist for "${artworkTitle}" was approved. Use the same email you provided and sign in to complete your Certificate of Authenticity linked to this work.`,
      ctaUrl: claimUrl,
      ctaLabel: 'Complete certificate',
    },
  );
}
