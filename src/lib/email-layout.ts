/**
 * Shared email HTML shell (table layout, masthead) + theme types.
 * Colors come from DB-backed settings or defaults.
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

/** Nested-table CTA for clients that ignore styled text links. */
export function buildBulletproofButtonTable(
  href: string,
  label: string,
  theme: EmailTheme,
): string {
  const { wine, fontFamily } = theme;
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  const labelColor = '#F5F1E8';
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;border-collapse:collapse;">
  <tr>
    <td align="left" bgcolor="${wine}" style="border-radius:6px;background-color:${wine};">
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:${fontFamily};font-size:16px;font-weight:600;line-height:1.2;color:${labelColor};text-decoration:none;border-radius:6px;">
        ${safeLabel}
      </a>
    </td>
  </tr>
</table>`.trim();
}

export function buildEmailFooterHtml(theme: EmailTheme): string {
  const { inkMuted, wine, fontFamily } = theme;
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
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:32px;padding-top:24px;border-collapse:collapse;border-top:1px solid ${wine};">
  <tr>
    <td style="font-family:${fontFamily};font-size:13px;line-height:1.55;color:${inkMuted};">
      <p style="margin:0 0 10px;">You are receiving this email because of activity on Provenance.</p>
      <p style="margin:0 0 10px;">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${wine};font-weight:600;text-decoration:none;">${safeHost}</a>
      </p>
      <p style="margin:0;font-size:12px;color:${inkMuted};opacity:0.9;">&copy; Provenance. All rights reserved.</p>
    </td>
  </tr>
</table>`.trim();
}

/**
 * Matches landing masthead (`src/app/page.tsx`):
 * title: text-6xl sm:text-8xl → 60px mobile, 96px ≥640px
 * subtitle: text-xl sm:text-2xl → 20px mobile, 24px ≥640px
 * both: font-bold / font-light, tracking-tight (-0.025em), font-landing stack
 */
export function buildEmailMastheadRows(theme: EmailTheme): string {
  const { wine, inkSubtitle, parchment, fontFamily, mastheadTitle, mastheadSubtitle } = theme;
  return `
  <tr>
    <td align="center" style="padding: 40px 24px 12px; background-color: ${parchment};">
      <span class="email-masthead-title" style="display: block; font-family: ${fontFamily}; font-size: 60px; line-height: 1.05; font-weight: 700; letter-spacing: -0.025em; color: ${wine}; text-align: center;">
        ${escapeHtml(mastheadTitle)}
      </span>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding: 0 24px 28px; background-color: ${parchment};">
      <span class="email-masthead-subtitle" style="display: block; font-family: ${fontFamily}; font-size: 20px; line-height: 1.35; font-weight: 300; letter-spacing: -0.025em; color: ${inkSubtitle}; text-align: center;">
        ${escapeHtml(mastheadSubtitle)}
      </span>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding: 0 24px 28px; background-color: ${parchment};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width: 100%; max-width: 560px;">
        <tr>
          <td height="1" bgcolor="${wine}" style="height: 1px; line-height: 1px; font-size: 1px; background-color: ${wine};">&nbsp;</td>
        </tr>
      </table>
    </td>
  </tr>
  `.trim();
}

/**
 * Full HTML document with masthead + inner body (already HTML fragment).
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
    /* Match landing: sm breakpoint 640px — text-8xl / text-2xl */
    @media only screen and (min-width: 640px) {
      .email-masthead-title { font-size: 96px !important; line-height: 1 !important; }
      .email-masthead-subtitle { font-size: 24px !important; line-height: 1.3 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${parchment};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${parchment}" style="width: 100%; background-color: ${parchment}; margin: 0; padding: 0; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 24px 16px 40px; background-color: ${parchment};">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${parchment}" style="width: 100%; max-width: 600px; background-color: ${parchment}; border-collapse: collapse;">
          ${buildEmailMastheadRows(theme)}
          <tr>
            <td align="left" style="padding: 12px 16px 32px; font-family: ${fontFamily}; font-size: 16px; line-height: 1.6; color: ${ink}; background-color: ${parchment};">
              ${innerHtml}
              ${buildEmailFooterHtml(theme)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
