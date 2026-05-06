/**
 * Shared email HTML shell (table layout, mastheads) + theme tokens.
 * Three selectable presets ({@link EMAIL_LAYOUT_PRESET_LABELS}) — each with
 * distinct art-platform typography, palettes, and layout chrome.
 */

export type EmailLayoutPresetId = 'heritage' | 'studio' | 'archive';

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
  /** Studio: dark editorial banner */
  bannerBg?: string;
  bannerText?: string;
  bannerMuted?: string;
  /** Heritage: gold-ish rule; Archive: slate hairline accents */
  accentLine?: string;
  /** Archive: monospace catalog label above wordmark */
  mastheadMonoLabel?: string;
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
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0 8px;border-collapse:collapse;">
  <tr>
    <td align="center" bgcolor="${wine}" style="background-color:${wine};border-radius:10px;border:1px solid ${wine};mso-padding-alt:0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="10%" stroke="f" fillcolor="${wine}">
        <w:anchorlock/>
        <center style="color:#FFFFFF;font-family:${fontFamily};font-size:16px;font-weight:600;letter-spacing:0.02em;mso-text-raise:8;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:block;background-color:${wine};border:1px solid ${wine};border-radius:10px;padding:16px 32px;font-family:${fontFamily};font-size:16px;font-weight:600;letter-spacing:0.02em;line-height:1.2;color:#FFFFFF;text-decoration:none;text-align:center;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
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
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0 8px;border-collapse:collapse;">
  <tr>
    <td align="center" style="background-color:transparent;border-radius:10px;border:1px solid ${wine};mso-padding-alt:0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="10%" strokecolor="${wine}" fillcolor="#FFFFFF">
        <w:anchorlock/>
        <center style="color:${wine};font-family:${fontFamily};font-size:16px;font-weight:600;letter-spacing:0.02em;mso-text-raise:8;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:block;background-color:transparent;border:1px solid ${wine};border-radius:10px;padding:16px 32px;font-family:${fontFamily};font-size:16px;font-weight:600;letter-spacing:0.02em;line-height:1.2;color:${wine};text-decoration:none;text-align:center;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

export function buildEmailFooterHtml(theme: EmailTheme): string {
  const { inkMuted, wine, fontFamily, mastheadTitle, footerRule } = theme;
  const siteUrl = getPublicSiteUrlForEmail();
  const safeUrl = escapeHtml(siteUrl);
  let host = siteUrl;
  try {
    host = new URL(siteUrl).host;
  } catch {
    /* keep full string */
  }
  const safeHost = escapeHtml(host);
  const ruleColor = footerRule || '#E4E4E7';

  if (theme.preset === 'studio') {
    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:40px;border-collapse:collapse;">
  <tr>
    <td height="1" bgcolor="${ruleColor}" style="height:1px;line-height:1px;font-size:1px;background-color:${ruleColor};">&nbsp;</td>
  </tr>
  <tr>
    <td style="padding:26px 0 0;font-family:${fontFamily};text-align:left;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:650;letter-spacing:0.42em;color:${wine};">${escapeHtml(mastheadTitle)}</p>
      <p style="margin:0 0 8px;font-size:12px;line-height:1.65;color:${inkMuted};">You are receiving this email because of activity on your account.</p>
      <p style="margin:0;font-size:12px;color:${inkMuted};">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${wine};font-weight:600;text-decoration:none;border-bottom:1px solid rgba(0,0,0,.12);">${safeHost}</a>
      </p>
      <p style="margin:10px 0 0;font-size:11px;color:${inkMuted};">&copy; Provenance · All rights reserved</p>
    </td>
  </tr>
</table>`.trim();
  }

  if (theme.preset === 'archive') {
    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:40px;border-collapse:collapse;">
  <tr>
    <td height="1" bgcolor="${ruleColor}" style="height:1px;line-height:1px;font-size:1px;background-color:${ruleColor};">&nbsp;</td>
  </tr>
  <tr>
    <td style="padding:26px 0 4px;font-family:${fontFamily};text-align:left;">
      <p style="margin:0 0 8px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px;font-weight:600;letter-spacing:0.2em;color:${inkMuted};text-transform:uppercase;">Transmission log</p>
      <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${inkMuted};">You are receiving this email because of activity on your account.</p>
      <p style="margin:0;font-size:12px;color:${inkMuted};">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${wine};font-weight:600;text-decoration:none;">${safeHost}</a>
      </p>
      <p style="margin:10px 0 0;font-size:11px;color:${inkMuted};">&copy; Provenance</p>
    </td>
  </tr>
</table>`.trim();
  }

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:44px;border-collapse:collapse;">
  <tr>
    <td height="1" bgcolor="${ruleColor}" style="height:1px;line-height:1px;font-size:1px;background-color:${ruleColor};">&nbsp;</td>
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

/** Masthead region above the white content card — layout varies sharply by preset. */
export function buildEmailMastheadRows(theme: EmailTheme): string {
  const {
    parchment,
    fontFamily,
    mastheadTitle,
    mastheadSubtitle,
    wine,
    inkSubtitle,
    accentLine,
    bannerBg,
    bannerText,
    bannerMuted,
    mastheadMonoLabel,
  } = theme;

  if (theme.preset === 'studio' && bannerBg && bannerText) {
    const sub = mastheadSubtitle;
    const bm = bannerMuted || '#A1A1AA';
    return `
  <tr>
    <td style="padding:0;background-color:${parchment};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${bannerBg};">
        <tr>
          <td align="left" style="padding:40px 32px 36px;background-color:${bannerBg};">
            <p style="margin:0 0 22px;font-family:${fontFamily};font-size:11px;font-weight:650;color:${bm};letter-spacing:0.34em;text-transform:uppercase;">${escapeHtml(sub)}</p>
            <p class="email-wordmark" style="margin:0;font-family:${fontFamily};font-size:28px;font-weight:700;color:${bannerText};letter-spacing:-0.045em;line-height:1.05;text-align:left;">${escapeHtml(mastheadTitle)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`.trim();
  }

  if (theme.preset === 'archive' && mastheadMonoLabel) {
    const stripe = accentLine || wine;
    return `
  <tr>
    <td style="padding:48px 32px 36px;background-color:${parchment};border-bottom:1px solid ${theme.cardBorder};">
      <p style="margin:0 0 10px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;font-weight:700;letter-spacing:0.24em;color:${stripe};">${escapeHtml(mastheadMonoLabel)}</p>
      <p style="margin:0 0 6px;font-family:${fontFamily};font-size:26px;font-weight:700;color:${wine};letter-spacing:-0.02em;line-height:1.1;">${escapeHtml(mastheadTitle)}</p>
      <p style="margin:0;font-family:${fontFamily};font-size:12px;font-weight:600;color:${inkSubtitle};letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(mastheadSubtitle)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;border-collapse:collapse;">
        <tr>
          <td width="52" bgcolor="${stripe}" style="width:52px;height:4px;background-color:${stripe};font-size:1px;line-height:1px;">&nbsp;</td>
          <td style="padding-left:12px;">&nbsp;</td>
          <td style="padding:0;"></td>
        </tr>
      </table>
    </td>
  </tr>`.trim();
  }

  const gold = accentLine || '#C4A574';
  return `
  <tr>
    <td height="3" bgcolor="${gold}" style="height:3px;background-color:${gold};font-size:1px;line-height:1px;">&nbsp;</td>
  </tr>
  <tr>
    <td height="4" bgcolor="${wine}" style="height:4px;background-color:${wine};font-size:1px;line-height:1px;">&nbsp;</td>
  </tr>
  <tr>
    <td align="center" style="padding:40px 32px 12px;background-color:${parchment};">
      <span class="email-wordmark" style="display:block;font-family:${fontFamily};font-size:12px;font-weight:700;letter-spacing:0.48em;color:${wine};text-transform:uppercase;text-align:center;">${escapeHtml(mastheadTitle)}</span>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:0 32px 16px;background-color:${parchment};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto;">
        <tr>
          <td width="48" height="1" bgcolor="${wine}" style="width:48px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td>
          <td width="14" align="center" style="padding:0 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;">
              <tr>
                <td width="5" height="5" bgcolor="${gold}" style="width:5px;height:5px;border-radius:50%;line-height:1px;font-size:1px;">&nbsp;</td>
              </tr>
            </table>
          </td>
          <td width="48" height="1" bgcolor="${wine}" style="width:48px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:0 32px 36px;background-color:${parchment};">
      <span style="display:block;font-family:${fontFamily};font-size:10px;font-weight:600;letter-spacing:0.34em;color:${inkSubtitle};text-transform:uppercase;text-align:center;">${escapeHtml(mastheadSubtitle)}</span>
    </td>
  </tr>`.trim();
}

export function buildEmailHtml(pageTitle: string, innerHtml: string, theme: EmailTheme): string {
  const { parchment, cardBg, cardBorder, fontFamily, ink, preset } = theme;

  let cardRadius = '';
  let cardShadow = '';
  if (preset === 'studio') {
    cardRadius = 'border-radius:12px;';
    cardShadow =
      'box-shadow:0 22px 50px rgba(24,24,27,.09),0 0 1px rgba(24,24,27,.06);';
  } else if (preset === 'heritage') {
    cardRadius = 'border-radius:2px;';
    cardShadow =
      'box-shadow:0 28px 60px rgba(107,54,48,.065),inset 0 1px 0 rgba(255,255,255,.9);';
  } else if (preset === 'archive') {
    cardRadius = 'border-radius:10px 10px 10px 0;';
    cardShadow =
      'box-shadow:12px 16px 0 rgba(148,163,184,.07),0 0 0 1px rgba(203,213,225,.95);';
  }

  let extraCss = `
    .email-wordmark strong { font-weight: 650; }
  `;
  if (preset === 'studio') {
    extraCss += `
    .email-wordmark { font-weight: 700 !important; }
    `;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(pageTitle)}</title>
  <style type="text/css">
${extraCss}
  </style>
</head>
<body style="margin:0;padding:0;background-color:${parchment};">
  <!--[if mso]><table role="presentation" width="650" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${parchment}" style="width:100%;background-color:${parchment};margin:0;padding:0;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:${preset === 'studio' ? '24px 20px 64px' : '0 18px 56px'};background-color:${parchment};">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;">

          ${buildEmailMastheadRows(theme)}

          <!-- Main content -->
          <tr>
            <td style="padding:0;background-color:${parchment};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;border-collapse:collapse;border:1px solid ${cardBorder};background-color:${cardBg};${cardRadius}${cardShadow}">
                <tr>
                  <td style="padding:${preset === 'archive' ? '36px 40px 40px' : '40px 44px'};font-family:${fontFamily};font-size:15px;line-height:1.75;color:${ink};background-color:${cardBg};">
                    ${innerHtml}
                    ${buildEmailFooterHtml(theme)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td height="48" style="height:48px;background-color:${parchment};font-size:1px;line-height:1px;">&nbsp;</td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`.trim();
}
