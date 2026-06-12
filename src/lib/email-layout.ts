/**
 * Shared email HTML shell (table layout) + minimal theme tokens.
 */

export type EmailLayoutPresetId = 'minimal';

export type EmailTheme = {
  preset: EmailLayoutPresetId;
  parchment: string;
  cardBg: string;
  cardBorder: string;
  ink: string;
  wine: string;
  inkSubtitle: string;
  inkMuted: string;
  /** Blockquotes / inline code tint */
  surfaceMuted: string;
  mastheadTitle: string;
  mastheadSubtitle: string;
  /** Body copy */
  fontFamily: string;
  /** Headings (Markdown h1–h3) */
  fontFamilyHeading: string;
  footerRule: string;
};

/** Sans fallback preserved for templates that omit heading font until merge */
export const EMAIL_FONT_FAMILY_FALLBACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

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

/** Primary pill CTA — background on TD + anchor for Gmail fidelity */
export function buildBulletproofButtonTable(
  href: string,
  label: string,
  theme: EmailTheme,
): string {
  const { wine, fontFamily } = theme;
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0 8px;border-collapse:collapse;">
  <tr>
    <td align="center" bgcolor="${wine}" style="background-color:${wine};border-radius:8px;border:1px solid ${wine};mso-padding-alt:0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="12%" stroke="f" fillcolor="${wine}">
        <w:anchorlock/>
        <center style="color:#FFFFFF;font-family:${fontFamily};font-size:15px;font-weight:600;mso-text-raise:8;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:block;background-color:${wine};border:1px solid ${wine};border-radius:8px;padding:14px 28px;font-family:${fontFamily};font-size:15px;font-weight:600;line-height:1.2;color:#FFFFFF;text-decoration:none;text-align:center;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

/** Secondary outline pill */
export function buildBulletproofSecondaryButtonTable(
  href: string,
  label: string,
  theme: EmailTheme,
): string {
  const { wine, fontFamily } = theme;
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0 8px;border-collapse:collapse;">
  <tr>
    <td align="center" style="background-color:transparent;border-radius:8px;border:1px solid ${wine};mso-padding-alt:0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="12%" strokecolor="${wine}" fillcolor="#FFFFFF">
        <w:anchorlock/>
        <center style="color:${wine};font-family:${fontFamily};font-size:15px;font-weight:600;mso-text-raise:8;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:block;background-color:transparent;border:1px solid ${wine};border-radius:8px;padding:14px 28px;font-family:${fontFamily};font-size:15px;font-weight:600;line-height:1.2;color:${wine};text-decoration:none;text-align:center;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

export function buildEmailFooterHtml(theme: EmailTheme): string {
  const { inkMuted, wine, fontFamily, footerRule } = theme;
  const siteUrl = getPublicSiteUrlForEmail();
  const safeUrl = escapeHtml(siteUrl);
  let host = siteUrl;
  try {
    host = new URL(siteUrl).host;
  } catch {
    /* keep full string */
  }
  const safeHost = escapeHtml(host);
  const ruleColor = footerRule || '#E5E5E5';

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:40px;border-collapse:collapse;">
  <tr>
    <td height="1" bgcolor="${ruleColor}" style="height:1px;line-height:1px;font-size:1px;background-color:${ruleColor};">&nbsp;</td>
  </tr>
  <tr>
    <td style="padding:24px 0 0;font-family:${fontFamily};text-align:left;">
      <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${inkMuted};">You are receiving this email because of activity on your account.</p>
      <p style="margin:0;font-size:12px;color:${inkMuted};">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${wine};font-weight:500;text-decoration:underline;">${safeHost}</a>
        <span style="color:#D4D4D4;padding:0 6px;">&middot;</span>
        <span>&copy; Provenance</span>
      </p>
    </td>
  </tr>
</table>`.trim();
}

/** Masthead region — minimal wordmark + hairline rule */
export function buildEmailMastheadRows(theme: EmailTheme): string {
  const { parchment, fontFamily, mastheadTitle, mastheadSubtitle, inkSubtitle, footerRule } = theme;
  const ruleColor = footerRule || '#E5E5E5';

  return `
  <tr>
    <td style="padding:40px 32px 0;background-color:${parchment};">
      <p style="margin:0;font-family:${fontFamily};font-size:11px;font-weight:600;letter-spacing:0.32em;color:${theme.ink};text-transform:uppercase;">${escapeHtml(mastheadTitle)}</p>
      <p style="margin:8px 0 0;font-family:${fontFamily};font-size:12px;font-weight:400;color:${inkSubtitle};letter-spacing:0.02em;">${escapeHtml(mastheadSubtitle)}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 0;background-color:${parchment};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td height="1" bgcolor="${ruleColor}" style="height:1px;line-height:1px;font-size:1px;background-color:${ruleColor};">&nbsp;</td>
        </tr>
      </table>
    </td>
  </tr>`.trim();
}

export function buildEmailHtml(pageTitle: string, innerHtml: string, theme: EmailTheme): string {
  const { parchment, cardBg, cardBorder, fontFamily, ink } = theme;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(pageTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:${parchment};">
  <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${parchment}" style="width:100%;background-color:${parchment};margin:0;padding:0;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:0 20px 56px;background-color:${parchment};">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:collapse;">

          ${buildEmailMastheadRows(theme)}

          <!-- Main content -->
          <tr>
            <td style="padding:24px 0 0;background-color:${parchment};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;border-collapse:collapse;border:1px solid ${cardBorder};background-color:${cardBg};border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
                <tr>
                  <td style="padding:48px;font-family:${fontFamily};font-size:16px;line-height:1.7;color:${ink};background-color:${cardBg};">
                    ${innerHtml}
                    ${buildEmailFooterHtml(theme)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td height="32" style="height:32px;background-color:${parchment};font-size:1px;line-height:1px;">&nbsp;</td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`.trim();
}
