/**
 * Shared email HTML shell (table layout, masthead) + theme types.
 * Colors come from DB-backed settings or defaults.
 *
 * Supports 3 distinct visual styles:
 * 1. EDITORIAL - Bold magazine style with dramatic typography
 * 2. GALLERY - Refined museum/gallery aesthetic
 * 3. MINIMAL - Clean, warm, friendly approach
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

export type EmailStyle = 'editorial' | 'gallery' | 'minimal';

export const EMAIL_FONT_FAMILY =
  '"Gotham", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

export const EMAIL_FONT_SERIF =
  'Georgia, "Times New Roman", serif';

export const EMAIL_FONT_MONO =
  'ui-monospace, "SF Mono", Monaco, "Cascadia Code", monospace';

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
 * Gallery-quality primary CTA button — white label on wine background.
 *
 * Design notes:
 *   - Background applied to BOTH <td> and <a> so Gmail web / Apple Mail
 *     dark-mode can't lose the fill behind the link.
 *   - display:block on the <a> makes the entire pill a click target,
 *     not just the text run.
 *   - Pure white (#FFFFFF) on wine (#4A2F25) exceeds WCAG AAA (10.5:1).
 *   - 6px radius — refined but approachable.
 *   - 16px / 32px padding with mso-padding-alt:0 so the VML height is
 *     authoritative in Outlook 07–19.
 *   - -webkit-text-size-adjust:none prevents iOS from bumping font-size.
 *   - border:1px solid wine preserves the edge when dark-mode clients
 *     override backgrounds but keep borders.
 *   - VML <v:roundrect> kept in lockstep (arcsize 10%, height 52px).
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
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0 8px;border-collapse:collapse;">
  <tr>
    <td align="center" bgcolor="${wine}" style="background-color:${wine};border-radius:6px;border:1px solid ${wine};mso-padding-alt:0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="10%" stroke="f" fillcolor="${wine}">
        <w:anchorlock/>
        <center style="color:#FFFFFF;font-family:${fontFamily};font-size:16px;font-weight:600;letter-spacing:0.02em;mso-text-raise:8;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:block;background-color:${wine};border:1px solid ${wine};border-radius:6px;padding:16px 32px;font-family:${fontFamily};font-size:16px;font-weight:600;letter-spacing:0.02em;line-height:1.2;color:#FFFFFF;text-decoration:none;text-align:center;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

/**
 * Secondary CTA button — outline variant: transparent fill, wine border, wine label.
 * Use beneath a primary button to offer a lower-weight second action.
 */
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
    <td align="center" style="background-color:transparent;border-radius:6px;border:1px solid ${wine};mso-padding-alt:0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="10%" strokecolor="${wine}" fillcolor="#FFFFFF">
        <w:anchorlock/>
        <center style="color:${wine};font-family:${fontFamily};font-size:16px;font-weight:600;letter-spacing:0.02em;mso-text-raise:8;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:block;background-color:transparent;border:1px solid ${wine};border-radius:6px;padding:16px 32px;font-family:${fontFamily};font-size:16px;font-weight:600;letter-spacing:0.02em;line-height:1.2;color:${wine};text-decoration:none;text-align:center;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
      <!--<![endif]-->
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

/* ═══════════════════════════════════════════════════════════════════════════
 * STYLE 1: EDITORIAL
 * Bold, magazine-inspired design with dramatic typography and asymmetric layout
 * Think: Artforum, Frieze, or a high-end design publication
 * ═══════════════════════════════════════════════════════════════════════════ */

const EDITORIAL_COLORS = {
  bg: '#0A0A0A',
  card: '#141414', 
  accent: '#E8FF47', // Electric lime - bold and contemporary
  text: '#FAFAFA',
  textMuted: '#888888',
  border: '#2A2A2A',
};

export function buildEditorialButtonTable(
  href: string,
  label: string,
): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:40px 0 16px;border-collapse:collapse;">
  <tr>
    <td align="left" bgcolor="${EDITORIAL_COLORS.accent}" style="background-color:${EDITORIAL_COLORS.accent};mso-padding-alt:0;">
      <!--[if mso]>
      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:56px;v-text-anchor:middle;width:220px;" stroke="f" fillcolor="${EDITORIAL_COLORS.accent}">
        <w:anchorlock/>
        <center style="color:${EDITORIAL_COLORS.bg};font-family:${EMAIL_FONT_FAMILY};font-size:13px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;">${safeLabel}</center>
      </v:rect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:block;background-color:${EDITORIAL_COLORS.accent};padding:18px 36px;font-family:${EMAIL_FONT_FAMILY};font-size:13px;font-weight:700;letter-spacing:0.15em;line-height:1.2;color:${EDITORIAL_COLORS.bg};text-decoration:none;text-transform:uppercase;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

export function buildEditorialFooterHtml(): string {
  const siteUrl = getPublicSiteUrlForEmail();
  const safeUrl = escapeHtml(siteUrl);
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:56px;border-collapse:collapse;">
  <tr>
    <td style="padding:32px 0 0;border-top:1px solid ${EDITORIAL_COLORS.border};font-family:${EMAIL_FONT_FAMILY};text-align:left;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding-bottom:20px;">
            <span style="font-size:10px;font-weight:700;letter-spacing:0.3em;color:${EDITORIAL_COLORS.textMuted};text-transform:uppercase;">Provenance</span>
          </td>
        </tr>
        <tr>
          <td>
            <p style="margin:0 0 8px;font-size:11px;line-height:1.7;color:${EDITORIAL_COLORS.textMuted};">
              <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${EDITORIAL_COLORS.text};text-decoration:none;">provenance.guru</a>
            </p>
            <p style="margin:0;font-size:11px;color:${EDITORIAL_COLORS.textMuted};">&copy; ${new Date().getFullYear()} Provenance</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

/**
 * EDITORIAL STYLE: Dark, bold, magazine-inspired
 * - Deep charcoal background
 * - Electric accent color  
 * - Sharp typography with dramatic sizing
 * - Asymmetric layout feel
 */
export function buildEditorialEmailHtml(pageTitle: string, innerHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(pageTitle)}</title>
  <style type="text/css">
    @media only screen and (max-width: 600px) {
      .editorial-hero { font-size: 36px !important; line-height: 1.1 !important; }
      .editorial-container { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${EDITORIAL_COLORS.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${EDITORIAL_COLORS.bg}" style="width:100%;background-color:${EDITORIAL_COLORS.bg};margin:0;padding:0;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:0;background-color:${EDITORIAL_COLORS.bg};">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;border-collapse:collapse;">
          
          <!-- Top accent bar -->
          <tr>
            <td height="4" bgcolor="${EDITORIAL_COLORS.accent}" style="height:4px;background-color:${EDITORIAL_COLORS.accent};font-size:1px;line-height:1px;">&nbsp;</td>
          </tr>
          
          <!-- Masthead -->
          <tr>
            <td class="editorial-container" style="padding:48px 48px 0;background-color:${EDITORIAL_COLORS.bg};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td>
                    <span style="display:inline-block;font-family:${EMAIL_FONT_FAMILY};font-size:11px;font-weight:800;letter-spacing:0.4em;color:${EDITORIAL_COLORS.accent};text-transform:uppercase;">Provenance</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content area -->
          <tr>
            <td class="editorial-container" style="padding:40px 48px 64px;background-color:${EDITORIAL_COLORS.bg};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="font-family:${EMAIL_FONT_FAMILY};font-size:16px;line-height:1.7;color:${EDITORIAL_COLORS.text};">
                    ${innerHtml}
                    ${buildEditorialFooterHtml()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * STYLE 2: GALLERY
 * Refined museum/gallery aesthetic - elegant, spacious, classical proportions
 * Think: MoMA, Gagosian, or a prestigious auction house
 * ═══════════════════════════════════════════════════════════════════════════ */

const GALLERY_COLORS = {
  bg: '#F7F6F3',
  card: '#FFFFFF',
  accent: '#1A1A1A', // Pure black - timeless and authoritative
  accentSecondary: '#8B7355', // Warm bronze
  text: '#1A1A1A',
  textMuted: '#6B6B6B',
  border: '#E5E2DB',
  divider: '#D4CFC5',
};

export function buildGalleryButtonTable(
  href: string,
  label: string,
): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:36px 0 12px;border-collapse:collapse;">
  <tr>
    <td align="center" bgcolor="${GALLERY_COLORS.accent}" style="background-color:${GALLERY_COLORS.accent};border:1px solid ${GALLERY_COLORS.accent};mso-padding-alt:0;">
      <!--[if mso]>
      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:52px;v-text-anchor:middle;width:200px;" stroke="f" fillcolor="${GALLERY_COLORS.accent}">
        <w:anchorlock/>
        <center style="color:#FFFFFF;font-family:${EMAIL_FONT_SERIF};font-size:14px;font-weight:400;letter-spacing:0.08em;">${safeLabel}</center>
      </v:rect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:block;background-color:${GALLERY_COLORS.accent};border:1px solid ${GALLERY_COLORS.accent};padding:16px 40px;font-family:${EMAIL_FONT_SERIF};font-size:14px;font-weight:400;letter-spacing:0.08em;line-height:1.2;color:#FFFFFF;text-decoration:none;text-align:center;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

export function buildGallerySecondaryButtonTable(
  href: string,
  label: string,
): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0 8px;border-collapse:collapse;">
  <tr>
    <td align="center" style="background-color:transparent;border:1px solid ${GALLERY_COLORS.accent};mso-padding-alt:0;">
      <!--[if mso]>
      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:52px;v-text-anchor:middle;width:200px;" strokecolor="${GALLERY_COLORS.accent}" fillcolor="#FFFFFF">
        <w:anchorlock/>
        <center style="color:${GALLERY_COLORS.accent};font-family:${EMAIL_FONT_SERIF};font-size:14px;font-weight:400;letter-spacing:0.08em;">${safeLabel}</center>
      </v:rect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:block;background-color:transparent;border:1px solid ${GALLERY_COLORS.accent};padding:16px 40px;font-family:${EMAIL_FONT_SERIF};font-size:14px;font-weight:400;letter-spacing:0.08em;line-height:1.2;color:${GALLERY_COLORS.accent};text-decoration:none;text-align:center;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

export function buildGalleryFooterHtml(): string {
  const siteUrl = getPublicSiteUrlForEmail();
  const safeUrl = escapeHtml(siteUrl);
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:56px;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:0 0 24px;">
      <!-- Ornamental divider -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto;">
        <tr>
          <td width="60" height="1" bgcolor="${GALLERY_COLORS.divider}" style="width:60px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td>
          <td width="20" align="center" style="padding:0 8px;">
            <span style="font-family:${EMAIL_FONT_SERIF};font-size:16px;color:${GALLERY_COLORS.accentSecondary};">&loz;</span>
          </td>
          <td width="60" height="1" bgcolor="${GALLERY_COLORS.divider}" style="width:60px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0;font-family:${EMAIL_FONT_SERIF};text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;font-style:italic;color:${GALLERY_COLORS.textMuted};">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${GALLERY_COLORS.text};text-decoration:none;">provenance.guru</a>
      </p>
      <p style="margin:0;font-size:11px;color:${GALLERY_COLORS.textMuted};">&copy; ${new Date().getFullYear()} Provenance. All rights reserved.</p>
    </td>
  </tr>
</table>`.trim();
}

/**
 * GALLERY STYLE: Refined, spacious, museum-quality
 * - Warm neutral background
 * - White content card with subtle shadow
 * - Elegant serif typography
 * - Classical proportions and generous whitespace
 */
export function buildGalleryEmailHtml(pageTitle: string, innerHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(pageTitle)}</title>
  <style type="text/css">
    @media only screen and (max-width: 600px) {
      .gallery-container { padding-left: 20px !important; padding-right: 20px !important; }
      .gallery-card { padding: 36px 28px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${GALLERY_COLORS.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${GALLERY_COLORS.bg}" style="width:100%;background-color:${GALLERY_COLORS.bg};margin:0;padding:0;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 16px 60px;background-color:${GALLERY_COLORS.bg};">
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;border-collapse:collapse;">
          
          <!-- Masthead -->
          <tr>
            <td align="center" style="padding:0 0 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto;">
                <tr>
                  <td style="padding:0 16px;">
                    <span style="font-family:${EMAIL_FONT_SERIF};font-size:24px;font-weight:400;letter-spacing:0.12em;color:${GALLERY_COLORS.accent};text-transform:uppercase;">Provenance</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content card -->
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${GALLERY_COLORS.card};border:1px solid ${GALLERY_COLORS.border};">
                <tr>
                  <td class="gallery-card" style="padding:52px 48px 56px;font-family:${EMAIL_FONT_SERIF};font-size:16px;line-height:1.8;color:${GALLERY_COLORS.text};">
                    ${innerHtml}
                    ${buildGalleryFooterHtml()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * STYLE 3: MINIMAL
 * Clean, warm, friendly - modern simplicity with a human touch
 * Think: Apple, Notion, or a boutique design studio
 * ═══════════════════════════════════════════════════════════════════════════ */

const MINIMAL_COLORS = {
  bg: '#FDFCFB',
  card: '#FFFFFF',
  accent: '#2D5A4A', // Sophisticated sage green - approachable yet refined
  accentLight: '#E8F0ED',
  text: '#2C2C2C',
  textMuted: '#7A7A7A',
  border: '#EAEAEA',
  warmAccent: '#F5E6D3', // Warm cream for subtle highlights
};

export function buildMinimalButtonTable(
  href: string,
  label: string,
): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0 12px;border-collapse:collapse;">
  <tr>
    <td align="center" bgcolor="${MINIMAL_COLORS.accent}" style="background-color:${MINIMAL_COLORS.accent};border-radius:8px;mso-padding-alt:0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:50px;v-text-anchor:middle;width:180px;" arcsize="16%" stroke="f" fillcolor="${MINIMAL_COLORS.accent}">
        <w:anchorlock/>
        <center style="color:#FFFFFF;font-family:${EMAIL_FONT_FAMILY};font-size:15px;font-weight:600;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:block;background-color:${MINIMAL_COLORS.accent};border-radius:8px;padding:14px 32px;font-family:${EMAIL_FONT_FAMILY};font-size:15px;font-weight:600;line-height:1.3;color:#FFFFFF;text-decoration:none;text-align:center;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

export function buildMinimalSecondaryButtonTable(
  href: string,
  label: string,
): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0;border-collapse:collapse;">
  <tr>
    <td align="center">
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;font-family:${EMAIL_FONT_FAMILY};font-size:14px;font-weight:500;color:${MINIMAL_COLORS.accent};text-decoration:underline;text-underline-offset:3px;">${safeLabel}</a>
    </td>
  </tr>
</table>`.trim();
}

export function buildMinimalFooterHtml(): string {
  const siteUrl = getPublicSiteUrlForEmail();
  const safeUrl = escapeHtml(siteUrl);
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:48px;border-collapse:collapse;">
  <tr>
    <td style="padding:24px 0 0;border-top:1px solid ${MINIMAL_COLORS.border};font-family:${EMAIL_FONT_FAMILY};text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;color:${MINIMAL_COLORS.textMuted};">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${MINIMAL_COLORS.accent};font-weight:500;text-decoration:none;">provenance.guru</a>
      </p>
      <p style="margin:0;font-size:12px;color:${MINIMAL_COLORS.textMuted};">Made with care for the art community</p>
    </td>
  </tr>
</table>`.trim();
}

/**
 * MINIMAL STYLE: Clean, warm, friendly
 * - Near-white background with subtle warmth
 * - Approachable sage green accent
 * - Clean sans-serif typography
 * - Generous spacing, friendly tone
 */
export function buildMinimalEmailHtml(pageTitle: string, innerHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(pageTitle)}</title>
  <style type="text/css">
    @media only screen and (max-width: 600px) {
      .minimal-container { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${MINIMAL_COLORS.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${MINIMAL_COLORS.bg}" style="width:100%;background-color:${MINIMAL_COLORS.bg};margin:0;padding:0;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:48px 16px 56px;background-color:${MINIMAL_COLORS.bg};">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;border-collapse:collapse;">
          
          <!-- Simple logo mark -->
          <tr>
            <td align="center" style="padding:0 0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;">
                <tr>
                  <td width="40" height="40" bgcolor="${MINIMAL_COLORS.accent}" style="width:40px;height:40px;border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="font-family:${EMAIL_FONT_SERIF};font-size:20px;font-weight:600;color:#FFFFFF;line-height:40px;">P</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content area -->
          <tr>
            <td class="minimal-container" style="padding:0 8px;font-family:${EMAIL_FONT_FAMILY};font-size:16px;line-height:1.7;color:${MINIMAL_COLORS.text};">
              ${innerHtml}
              ${buildMinimalFooterHtml()}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Export color schemes for use in markdown rendering
 * ═══════════════════════════════════════════════════════════════════════════ */

export { EDITORIAL_COLORS, GALLERY_COLORS, MINIMAL_COLORS };
