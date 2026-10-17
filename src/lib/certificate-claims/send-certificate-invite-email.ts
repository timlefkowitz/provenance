import { sendNotificationEmail } from '~/lib/email';
import {
  getCertificateClaimUrl,
  getExhibitionSubmitUrl,
} from '~/lib/certificate-claims/site-url';
import { stripMarkdown } from '~/lib/strip-markdown';

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
    { strict: true },
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

/**
 * Send a single consolidated email inviting an artist to accept Certificates of
 * Authenticity for multiple works in one click. The token belongs to the first
 * invite; consumeCertificateClaim auto-claims all related artworks for the artist
 * under that owner in one go, so no additional emails are needed.
 */
export async function sendBatchArtistCoaInviteEmail(params: {
  to: string;
  recipientName: string;
  artworkTitles: string[];
  token: string;
  senderName?: string;
}): Promise<void> {
  const { to, recipientName, artworkTitles, token, senderName } = params;
  const claimUrl = getCertificateClaimUrl(token);
  const fromLine = senderName ? ` from ${senderName}` : '';
  const count = artworkTitles.length;
  console.log('[Certificates] sendBatchArtistCoaInviteEmail', { to, count, senderName });

  const isSingle = count === 1;
  const subject = isSingle
    ? `Complete your Certificate of Authenticity — ${artworkTitles[0]}`
    : `Complete your ${count} Certificates of Authenticity`;

  const worksList = artworkTitles.map((t) => `- "${t}"`).join('\n');
  const body = isSingle
    ? `You have been invited${fromLine} to complete your Certificate of Authenticity for "${artworkTitles[0]}". Sign in with this email address to complete your certificate — it will be automatically linked to the existing provenance record.`
    : `You have been invited${fromLine} to complete Certificates of Authenticity for ${count} works:\n\n${worksList}\n\nClick the button below to sign in and accept all ${count} certificates at once — they will each be automatically linked to the existing provenance records.`;

  await sendNotificationEmail(to, recipientName, subject, {
    title: isSingle
      ? 'Complete your Certificate of Authenticity'
      : `Complete your ${count} Certificates of Authenticity`,
    body,
    ctaUrl: claimUrl,
    ctaLabel: isSingle ? 'Complete certificate' : `Accept all ${count} certificates`,
  });
}

/**
 * One email listing all selected works; one token accepts the whole batch in consumeCertificateClaim.
 */
export async function sendBatchCollectorCooInviteEmail(params: {
  to: string;
  recipientName: string;
  artworkTitles: string[];
  token: string;
}): Promise<void> {
  const { to, recipientName, artworkTitles, token } = params;
  const claimUrl = getCertificateClaimUrl(token);
  const count = artworkTitles.length;
  console.log('[Certificates] sendBatchCollectorCooInviteEmail', { to, count });

  const isSingle = count === 1;
  const subject = isSingle
    ? `Claim your Certificate of Ownership — ${artworkTitles[0]}`
    : `Claim your ${count} Certificates of Ownership`;

  const worksList = artworkTitles.map((t) => `- "${t}"`).join('\n');
  const body = isSingle
    ? `You have been invited to claim a Certificate of Ownership for "${artworkTitles[0]}" linked to the artist's Certificate of Authenticity. Sign in with this email and accept to complete your claim.`
    : `You have been invited to claim Certificates of Ownership for ${count} works:\n\n${worksList}\n\nClick below to sign in and accept all ${count} certificates at once.`;

  await sendNotificationEmail(to, recipientName, subject, {
    title: isSingle ? 'Claim your certificate of ownership' : `Claim your ${count} certificates of ownership`,
    body,
    ctaUrl: claimUrl,
    ctaLabel: isSingle ? 'Claim certificate' : `Accept all ${count} certificates`,
  }, { strict: true });
}

export async function sendBatchGalleryCoSInviteEmail(params: {
  to: string;
  recipientName: string;
  artworkTitles: string[];
  artistNamesByTitle?: Record<string, string | undefined>;
  recipientRole: 'gallery' | 'institution';
  token: string;
}): Promise<void> {
  const { to, recipientName, artworkTitles, recipientRole, token } = params;
  const claimUrl = getCertificateClaimUrl(token);
  const roleLabel = recipientRole === 'institution' ? 'institution' : 'gallery';
  const count = artworkTitles.length;
  console.log('[Certificates] sendBatchGalleryCoSInviteEmail', { to, count, recipientRole });

  const isSingle = count === 1;
  const subject = isSingle
    ? `Create Certificate of Show — ${artworkTitles[0]}`
    : `Create ${count} Certificates of Show`;

  const worksList = artworkTitles.map((t) => `- "${t}"`).join('\n');
  const body = isSingle
    ? `An artist has invited your ${roleLabel} to issue a Certificate of Show for "${artworkTitles[0]}". Sign in with this email and accept to create the certificate — it will be linked to the artist's provenance record.`
    : `An artist has invited your ${roleLabel} to issue Certificates of Show for ${count} works:\n\n${worksList}\n\nClick below to sign in and accept all ${count} at once.`;

  await sendNotificationEmail(to, recipientName, subject, {
    title: isSingle ? 'Create a Certificate of Show' : `Create ${count} Certificates of Show`,
    body,
    ctaUrl: claimUrl,
    ctaLabel: isSingle ? 'Create Certificate of Show' : `Accept all ${count}`,
  });
}

export type ExhibitionInviteDetails = {
  title: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string | null;
  confirmedArtists: string[];
  /** False for artist-run shows, where no gallery Certificate of Show is issued. */
  issuesCertificateOfShow: boolean;
};

const MAX_EMAIL_DESCRIPTION_CHARS = 800;

/** Escape user-written text so it renders literally in the Markdown email body. */
function escapeMarkdown(text: string): string {
  return text
    .replace(/([\\`*_{}\[\]<>#|~])/g, '\\$1')
    .replace(/^(\s*)([-+])(?=\s)/gm, '$1\\$2')
    .replace(/^(\s*)(\d+)\.(?=\s)/gm, '$1$2\\.');
}

function formatExhibitionDate(isoDate: string): string {
  const date = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatExhibitionDateRange(startDate: string, endDate: string | null): string {
  const start = formatExhibitionDate(startDate);
  return endDate ? `${start} – ${formatExhibitionDate(endDate)}` : `Opens ${start}`;
}

export async function sendExhibitionArtistInviteEmail(params: {
  to: string;
  recipientName: string;
  exhibition: ExhibitionInviteDetails;
  senderName?: string;
  token: string;
  /** Most artworks the artist may upload; null/undefined = no limit. */
  maxArtworks?: number | null;
}): Promise<void> {
  const { to, recipientName, exhibition, senderName, token, maxArtworks } = params;
  const submitUrl = getExhibitionSubmitUrl(token);
  const fromLine = senderName ? ` by ${escapeMarkdown(senderName)}` : '';
  console.log('[Exhibitions] sendExhibitionArtistInviteEmail', {
    to,
    exhibitionTitle: exhibition.title,
    senderName,
    confirmedArtistCount: exhibition.confirmedArtists.length,
    maxArtworks: maxArtworks ?? null,
  });

  const detailLines = [
    `**When:** ${formatExhibitionDateRange(exhibition.startDate, exhibition.endDate)}`,
  ];
  if (exhibition.location?.trim()) {
    detailLines.push(`**Where:** ${escapeMarkdown(exhibition.location.trim())}`);
  }
  if (exhibition.confirmedArtists.length > 0) {
    detailLines.push(
      `**Confirmed artists:** ${exhibition.confirmedArtists.map(escapeMarkdown).join(', ')}`,
    );
  }
  if (maxArtworks) {
    detailLines.push(
      `**Submissions:** up to ${maxArtworks} ${maxArtworks === 1 ? 'artwork' : 'artworks'}, from which the final selection will be made`,
    );
  }

  const description = exhibition.description ? stripMarkdown(exhibition.description) : '';
  const descriptionBlock = description
    ? escapeMarkdown(
        description.length > MAX_EMAIL_DESCRIPTION_CHARS
          ? `${description.slice(0, MAX_EMAIL_DESCRIPTION_CHARS).trimEnd()}…`
          : description,
      )
    : null;

  const certificateLine = `Sign in with this email address and upload the work you will be showing. We will issue your Certificate of Authenticity${
    exhibition.issuesCertificateOfShow
      ? ' and the gallery will receive a linked Certificate of Show'
      : ' and add the work to the exhibition'
  }.`;

  const body = [
    `You have been invited${fromLine} to show in "${escapeMarkdown(exhibition.title)}".`,
    ...detailLines,
    ...(descriptionBlock ? [descriptionBlock] : []),
    certificateLine,
  ].join('\n');

  await sendNotificationEmail(
    to,
    recipientName,
    `You're invited to show in "${exhibition.title}"`,
    {
      title: 'You are invited to exhibit',
      body,
      ctaUrl: submitUrl,
      ctaLabel: 'Submit your work',
    },
  );
}
