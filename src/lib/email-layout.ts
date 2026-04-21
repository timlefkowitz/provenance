/**
 * Shared email HTML shell (table layout, masthead) + theme types.
 * Colors come from DB-backed settings or defaults.
 *
 * Design language: gallery letterhead — compact tracked wordmark, white content
 * card on a warm parchment ground, wine accent throughout, generous whitespace.
 */

export type EmailTheme = {
  parchment: string;
  ink: string;
  wine: string;
  inkSubtitle: string;
  inkMuted: string;
  mastheadTitle: string;
  mastheadSubtitle: string;
  fontFamily: string;
};

export const EMAIL_FONT_FAMILY =
  '"Gotham", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getPublicSiteUrlForEmail(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.provenance.guru';
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' || u.protocol === 'http:') {
      return raw.replace(/\/$/, '');
    }
  } catch {
    /* fall through */
  }
  return 'https://www.provenance.guru';
}

function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Remove the first markdown line that is `[any label](href)` for an exact href match.
 * Returns the bracket label (decoded) for use as the button label when present.
 */
export function stripMarkdownLinkLineByHref(
  markdown: string,
  href: string,
): { markdown: string; linkLabel: string | null } {
  const lineRe = new RegExp(
    `^\\s*\\[([^\\]]+)\\]\\(${escapeRegExp(href)}\\)\\s*$`,
    'm',
  );
  const match = markdown.match(lineRe);
  if (!match) {
    return { markdown, linkLabel: null };
  }
  const stripped = markdown
    .replace(lineRe, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '');
  return { markdown: stripped, linkLabel: decodeBasicHtmlEntities(match[1]) };
}

/**
 * Gallery-quality CTA button — uppercase tracked label on wine bg.
 * Bulletproof nested-table approach for Outlook compatibility.
 */
export function buildBulletproofButtonTable(
  href: string,
  label: string,
  theme: EmailTheme,
): string {
  const { wine, fontFamily } = theme;
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:36px 0 4px;border-collapse:collapse;">
  <tr>
    <td align="left" bgcolor="${wine}" style="background-color:${wine};border-radius:2px;">
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:16px 40px;font-family:${fontFamily};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;line-height:1.2;color:#F5F1E8;text-decoration:none;border-radius:2px;">
        ${safeLabel}
      </a>
    </td>
  </tr>
</table>`.trim();
}

/** Elegant footer: thin rule, repeated wordmark, site link, copyright. */
export function buildEmailFooterHtml(theme: EmailTheme): string {
  const { inkMuted, wine, fontFamily, mastheadTitle } = theme;
  const siteUrl = getPublicSiteUrlForEmail();
  const safeUrl = escapeHtml(siteUrl);
  let host = siteUrl;
  try {
    host = new URL(siteUrl).host;
  } catch {
    /* keep full string */
  }
  const safeHost = escapeHtml(host);
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:44px;border-collapse:collapse;">
  <tr>
    <td height="1" bgcolor="#D6D0C8" style="height:1px;line-height:1px;font-size:1px;background-color:#D6D0C8;">&nbsp;</td>
  </tr>
  <tr>
    <td style="padding:28px 0 4px;font-family:${fontFamily};text-align:center;">
      <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:0.5em;color:${wine};text-transform:uppercase;">${escapeHtml(mastheadTitle)}</p>
      <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${inkMuted};">You are receiving this email because of activity on your account.</p>
      <p style="margin:0;font-size:12px;color:${inkMuted};">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${wine};font-weight:600;text-decoration:none;">${safeHost}</a>
        <span style="color:#C8C3BB;padding:0 8px;">&middot;</span>
        <span>&copy; Provenance. All rights reserved.</span>
      </p>
    </td>
  </tr>
</table>`.trim();
}

/**
 * Gallery letterhead masthead:
 *   – 5 px wine accent bar at the very top
 *   – compact tracked wordmark (small caps, wide letter-spacing)
 *   – ornamental rule: line ∙ dot ∙ line
 *   – spaced subtitle in muted ink
 *
 * Replaces the old 60–96 px display-type masthead with something that reads
 * like museum or auction-house stationery.
 */
export function buildEmailMastheadRows(theme: EmailTheme): string {
  const { wine, inkSubtitle, parchment, fontFamily, mastheadTitle, mastheadSubtitle } = theme;
  return `
  <tr>
    <td height="5" bgcolor="${wine}" style="height:5px;background-color:${wine};font-size:1px;line-height:1px;">&nbsp;</td>
  </tr>
  <tr>
    <td align="center" style="padding:44px 32px 16px;background-color:${parchment};">
      <span class="email-wordmark" style="display:block;font-family:${fontFamily};font-size:11px;font-weight:700;letter-spacing:0.55em;color:${wine};text-transform:uppercase;text-align:center;">${escapeHtml(mastheadTitle)}</span>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:0 32px 16px;background-color:${parchment};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto;">
        <tr>
          <td width="56" height="1" bgcolor="${wine}" style="width:56px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td>
          <td width="16" align="center" style="padding:0 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;">
              <tr>
                <td width="5" height="5" bgcolor="${wine}" style="width:5px;height:5px;border-radius:50%;line-height:1px;font-size:1px;">&nbsp;</td>
              </tr>
            </table>
          </td>
          <td width="56" height="1" bgcolor="${wine}" style="width:56px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:0 32px 40px;background-color:${parchment};">
      <span style="display:block;font-family:${fontFamily};font-size:9px;font-weight:400;letter-spacing:0.32em;color:${inkSubtitle};text-transform:uppercase;text-align:center;">${escapeHtml(mastheadSubtitle)}</span>
    </td>
  </tr>`.trim();
}

/**
 * Full HTML document: parchment ground → masthead → white content card → footer.
 *
 * The content card (white, subtle border) lifts the body off the warm parchment
 * ground, creating a clean editorial hierarchy without needing images or heavy
 * design assets — every email client renders it correctly.
 */
export function buildEmailHtml(pageTitle: string, innerHtml: string, theme: EmailTheme): string {
  const { parchment, fontFamily, ink } = theme;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(pageTitle)}</title>
  <style type="text/css">
    @media only screen and (min-width: 640px) {
      .email-wordmark { font-size: 12px !important; letter-spacing: 0.65em !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${parchment};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${parchment}" style="width:100%;background-color:${parchment};margin:0;padding:0;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:0 16px 56px;background-color:${parchment};">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;">

          ${buildEmailMastheadRows(theme)}

          <!-- White content card sits on parchment ground -->
          <tr>
            <td style="padding:0;background-color:#FFFFFF;border-left:1px solid #E0DAD2;border-right:1px solid #E0DAD2;border-bottom:1px solid #E0DAD2;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:40px 44px 48px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};background-color:#FFFFFF;">
                    ${innerHtml}
                    ${buildEmailFooterHtml(theme)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bottom breathing room on parchment -->
          <tr>
            <td height="56" style="height:56px;background-color:${parchment};font-size:1px;line-height:1px;">&nbsp;</td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
