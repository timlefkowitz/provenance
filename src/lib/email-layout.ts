/**
 * Shared email HTML shell — bulletproof table layout with 8 switchable design styles.
 *
 * All email structural functions accept an `EmailTheme` and branch on its layout knobs
 * (`mastheadVariant`, `useCard`, `buttonRadius`, etc.) so every transactional email
 * automatically reflects whichever style is active without call-site changes.
 */

export type EmailLayoutPresetId =
  | 'atelier'
  | 'gallery'
  | 'editorial'
  | 'pop'
  | 'pastel'
  | 'mono'
  | 'sunset'
  | 'midnight';

/** Controls which masthead chrome is rendered before the content area. */
export type MastheadVariant =
  | 'double-rule'  // gold line + 3px gap + dim line (atelier)
  | 'single'       // wordmark + subtitle + single thin separator
  | 'centered'     // centered wordmark + subtitle + single rule
  | 'mono'         // monospace font wordmark + hairline
  | 'hero';        // full-bleed colored band containing the wordmark

export type EmailTheme = {
  preset: EmailLayoutPresetId;

  // ── Color palette ──────────────────────────────────────────────────────────
  parchment: string;       // page / outer background
  cardBg: string;          // content area background
  cardBorder: string;      // card border & dividers
  ink: string;             // primary body text
  wine: string;            // accent: links, h2, button fill
  /** Label color for text ON a wine/accent button. Must pass WCAG AA vs wine. */
  accentText: string;
  inkSubtitle: string;     // masthead subtitle
  inkMuted: string;        // footer / hint text
  surfaceMuted: string;    // blockquotes / code tint
  footerRule: string;      // footer divider rule

  // ── Masthead content ───────────────────────────────────────────────────────
  mastheadTitle: string;
  mastheadSubtitle: string;

  // ── Typography ─────────────────────────────────────────────────────────────
  fontFamily: string;
  fontFamilyHeading: string;

  // ── Layout knobs ───────────────────────────────────────────────────────────
  /** Wrap content in a bordered card vs. flowing directly on page background. */
  useCard: boolean;
  mastheadVariant: MastheadVariant;
  mastheadAlign: 'left' | 'center';
  /** CSS border-radius for the card, e.g. '4px', '12px', '0'. */
  cardRadius: string;
  /** Height (px) of the top accent bar on the card; 0 = no bar. */
  accentBarHeight: number;
  /** CSS border-radius for CTA buttons. */
  buttonRadius: string;
  buttonTextTransform: 'uppercase' | 'none';

  // Hero-band extras (only used when mastheadVariant='hero')
  heroBandColor?: string;
  heroBandTextColor?: string;
  heroBandSubtitleColor?: string;
};

/** Fallback sans stack for templates that do not specify fontFamily. */
export const EMAIL_FONT_FAMILY_FALLBACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

// ── Utilities ──────────────────────────────────────────────────────────────

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

// ── Button builders ────────────────────────────────────────────────────────

/** Primary filled CTA — nested table so the button shrinks to its content (not full-width). */
export function buildBulletproofButtonTable(
  href: string,
  label: string,
  theme: EmailTheme,
): string {
  const { wine, accentText, fontFamily, buttonRadius, buttonTextTransform } = theme;
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  const textTransformCss = buttonTextTransform === 'uppercase' ? 'text-transform:uppercase;' : '';
  const letterSpacing = buttonTextTransform === 'uppercase' ? '0.08em' : '0.02em';
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0 8px;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td align="center" bgcolor="${wine}" style="background-color:${wine};border-radius:${buttonRadius};border:1px solid ${wine};mso-padding-alt:0;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="10%" stroke="f" fillcolor="${wine}">
              <w:anchorlock/>
              <center style="color:${accentText};font-family:${fontFamily};font-size:14px;font-weight:700;letter-spacing:${letterSpacing};mso-text-raise:8;">${safeLabel}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-- -->
            <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:${wine};border-radius:${buttonRadius};padding:14px 32px;font-family:${fontFamily};font-size:14px;font-weight:700;letter-spacing:${letterSpacing};${textTransformCss}line-height:1.2;color:${accentText};text-decoration:none;text-align:center;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

/** Secondary outline CTA — accent-color border + label on card background. */
export function buildBulletproofSecondaryButtonTable(
  href: string,
  label: string,
  theme: EmailTheme,
): string {
  const { wine, cardBg, fontFamily, buttonRadius, buttonTextTransform } = theme;
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  const textTransformCss = buttonTextTransform === 'uppercase' ? 'text-transform:uppercase;' : '';
  const letterSpacing = buttonTextTransform === 'uppercase' ? '0.08em' : '0.02em';
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0 8px;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td align="center" bgcolor="${cardBg}" style="background-color:${cardBg};border-radius:${buttonRadius};border:1px solid ${wine};mso-padding-alt:0;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="10%" strokecolor="${wine}" fillcolor="${cardBg}">
              <w:anchorlock/>
              <center style="color:${wine};font-family:${fontFamily};font-size:14px;font-weight:700;letter-spacing:${letterSpacing};mso-text-raise:8;">${safeLabel}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-- -->
            <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:transparent;border:1px solid ${wine};border-radius:${buttonRadius};padding:14px 32px;font-family:${fontFamily};font-size:14px;font-weight:700;letter-spacing:${letterSpacing};${textTransformCss}line-height:1.2;color:${wine};text-decoration:none;text-align:center;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel}</a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

// ── Footer ─────────────────────────────────────────────────────────────────

export function buildEmailFooterHtml(theme: EmailTheme): string {
  const { inkMuted, wine, cardBg, fontFamily, footerRule } = theme;
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
    <td bgcolor="${cardBg}" style="padding:24px 0 0;background-color:${cardBg};font-family:${fontFamily};text-align:left;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.04em;line-height:1.6;color:${inkMuted};">You are receiving this email because of activity on your account.</p>
      <p style="margin:0;font-size:11px;letter-spacing:0.04em;color:${inkMuted};">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${wine};font-weight:500;text-decoration:none;">${safeHost}</a>
        <span style="color:${ruleColor};padding:0 6px;">&middot;</span>
        <span>&copy; Provenance</span>
      </p>
    </td>
  </tr>
</table>`.trim();
}

// ── Masthead builders (one per variant) ────────────────────────────────────

function buildDoubleRuleMasthead(theme: EmailTheme): string {
  const { parchment, fontFamily, mastheadTitle, mastheadSubtitle, inkSubtitle, wine, footerRule } = theme;
  const ruleColor = footerRule || '#3A2E25';
  return `
  <tr>
    <td bgcolor="${parchment}" style="padding:40px 48px 0;background-color:${parchment};">
      <p style="margin:0;font-family:${fontFamily};font-size:11px;font-weight:700;letter-spacing:0.38em;color:${wine};text-transform:uppercase;">${escapeHtml(mastheadTitle)}</p>
      <p style="margin:6px 0 0;font-family:${fontFamily};font-size:11px;font-weight:400;color:${inkSubtitle};letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(mastheadSubtitle)}</p>
    </td>
  </tr>
  <tr>
    <td bgcolor="${parchment}" style="padding:20px 48px 0;background-color:${parchment};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr><td height="1" bgcolor="${wine}" style="height:1px;line-height:1px;font-size:1px;background-color:${wine};">&nbsp;</td></tr>
        <tr><td height="3" bgcolor="${parchment}" style="height:3px;line-height:3px;font-size:1px;background-color:${parchment};">&nbsp;</td></tr>
        <tr><td height="1" bgcolor="${ruleColor}" style="height:1px;line-height:1px;font-size:1px;background-color:${ruleColor};">&nbsp;</td></tr>
      </table>
    </td>
  </tr>`.trim();
}

function buildSingleRuleMasthead(theme: EmailTheme): string {
  const { parchment, fontFamily, mastheadTitle, mastheadSubtitle, inkSubtitle, wine, cardBorder } = theme;
  const ruleColor = cardBorder || '#E5E5E5';
  return `
  <tr>
    <td bgcolor="${parchment}" style="padding:40px 48px 0;background-color:${parchment};">
      <p style="margin:0;font-family:${fontFamily};font-size:11px;font-weight:700;letter-spacing:0.22em;color:${wine};text-transform:uppercase;">${escapeHtml(mastheadTitle)}</p>
      <p style="margin:6px 0 0;font-family:${fontFamily};font-size:11px;font-weight:400;color:${inkSubtitle};letter-spacing:0.06em;text-transform:uppercase;">${escapeHtml(mastheadSubtitle)}</p>
    </td>
  </tr>
  <tr>
    <td bgcolor="${parchment}" style="padding:16px 48px 0;background-color:${parchment};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr><td height="1" bgcolor="${ruleColor}" style="height:1px;line-height:1px;font-size:1px;background-color:${ruleColor};">&nbsp;</td></tr>
      </table>
    </td>
  </tr>`.trim();
}

function buildCenteredMasthead(theme: EmailTheme): string {
  const { parchment, fontFamily, mastheadTitle, mastheadSubtitle, inkSubtitle, wine, footerRule } = theme;
  const ruleColor = footerRule || '#E5E5E5';
  return `
  <tr>
    <td bgcolor="${parchment}" style="padding:40px 48px 0;background-color:${parchment};text-align:center;">
      <p style="margin:0;font-family:${fontFamily};font-size:13px;font-weight:700;letter-spacing:0.3em;color:${wine};text-transform:uppercase;text-align:center;">${escapeHtml(mastheadTitle)}</p>
      <p style="margin:8px 0 0;font-family:${fontFamily};font-size:11px;font-weight:400;color:${inkSubtitle};letter-spacing:0.12em;text-transform:uppercase;text-align:center;">${escapeHtml(mastheadSubtitle)}</p>
    </td>
  </tr>
  <tr>
    <td bgcolor="${parchment}" style="padding:18px 48px 0;background-color:${parchment};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr><td height="2" bgcolor="${wine}" style="height:2px;line-height:2px;font-size:1px;background-color:${wine};">&nbsp;</td></tr>
        <tr><td height="1" bgcolor="${ruleColor}" style="height:1px;line-height:1px;font-size:1px;background-color:${ruleColor};">&nbsp;</td></tr>
      </table>
    </td>
  </tr>`.trim();
}

function buildMonoMasthead(theme: EmailTheme): string {
  const { parchment, mastheadTitle, mastheadSubtitle, inkMuted, wine, cardBorder } = theme;
  const monoFont = 'ui-monospace,"Courier New",monospace';
  const ruleColor = cardBorder || '#E5E5E5';
  return `
  <tr>
    <td bgcolor="${parchment}" style="padding:40px 48px 0;background-color:${parchment};">
      <p style="margin:0;font-family:${monoFont};font-size:12px;font-weight:700;letter-spacing:0.2em;color:${wine};text-transform:uppercase;">${escapeHtml(mastheadTitle)}</p>
      <p style="margin:6px 0 0;font-family:${monoFont};font-size:10px;font-weight:400;color:${inkMuted};letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(mastheadSubtitle)}</p>
    </td>
  </tr>
  <tr>
    <td bgcolor="${parchment}" style="padding:12px 48px 0;background-color:${parchment};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr><td height="1" bgcolor="${ruleColor}" style="height:1px;line-height:1px;font-size:1px;background-color:${ruleColor};">&nbsp;</td></tr>
      </table>
    </td>
  </tr>`.trim();
}

function buildHeroMasthead(theme: EmailTheme): string {
  const {
    fontFamily,
    mastheadTitle,
    heroBandColor = '#D4724A',
    heroBandTextColor = '#FFFFFF',
    heroBandSubtitleColor = 'rgba(255,255,255,0.75)',
    mastheadSubtitle,
  } = theme;
  return `
  <tr>
    <td bgcolor="${heroBandColor}" style="padding:48px 48px 44px;background-color:${heroBandColor};text-align:center;">
      <p style="margin:0;font-family:${fontFamily};font-size:13px;font-weight:700;letter-spacing:0.3em;color:${heroBandTextColor};text-transform:uppercase;text-align:center;">${escapeHtml(mastheadTitle)}</p>
      <p style="margin:10px 0 0;font-family:${fontFamily};font-size:11px;font-weight:400;color:${heroBandSubtitleColor};letter-spacing:0.12em;text-transform:uppercase;text-align:center;">${escapeHtml(mastheadSubtitle)}</p>
    </td>
  </tr>`.trim();
}

/** Dispatch to the right masthead renderer. */
export function buildEmailMastheadRows(theme: EmailTheme): string {
  switch (theme.mastheadVariant) {
    case 'double-rule': return buildDoubleRuleMasthead(theme);
    case 'single':      return buildSingleRuleMasthead(theme);
    case 'centered':    return buildCenteredMasthead(theme);
    case 'mono':        return buildMonoMasthead(theme);
    case 'hero':        return buildHeroMasthead(theme);
  }
}

// ── Content-area builders ──────────────────────────────────────────────────

function buildCardContentSection(innerHtml: string, theme: EmailTheme): string {
  const { parchment, cardBg, cardBorder, fontFamily, ink, wine, cardRadius, accentBarHeight } = theme;
  const gapPadding = theme.mastheadVariant === 'hero' ? '8px 0 0' : '20px 0 0';
  const accentBar =
    accentBarHeight > 0
      ? `<tr><td height="${accentBarHeight}" bgcolor="${wine}" style="height:${accentBarHeight}px;line-height:${accentBarHeight}px;font-size:1px;background-color:${wine};border-radius:${cardRadius} ${cardRadius} 0 0;">&nbsp;</td></tr>`
      : '';
  return `
  <tr>
    <td bgcolor="${parchment}" style="padding:${gapPadding};background-color:${parchment};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;border-collapse:collapse;border:1px solid ${cardBorder};background-color:${cardBg};border-radius:${cardRadius};">
        ${accentBar}
        <tr>
          <td bgcolor="${cardBg}" style="padding:48px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};background-color:${cardBg};">
            ${innerHtml}
            ${buildEmailFooterHtml(theme)}
          </td>
        </tr>
      </table>
    </td>
  </tr>`.trim();
}

function buildFlowContentSection(innerHtml: string, theme: EmailTheme): string {
  const { parchment, fontFamily, ink } = theme;
  return `
  <tr>
    <td bgcolor="${parchment}" style="padding:32px 0 0;background-color:${parchment};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td bgcolor="${parchment}" style="padding:0 48px 48px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};background-color:${parchment};">
            ${innerHtml}
            ${buildEmailFooterHtml(theme)}
          </td>
        </tr>
      </table>
    </td>
  </tr>`.trim();
}

// ── Full email shell ───────────────────────────────────────────────────────

export function buildEmailHtml(pageTitle: string, innerHtml: string, theme: EmailTheme): string {
  const { parchment } = theme;
  const mastheadRows = buildEmailMastheadRows(theme);
  const contentSection = theme.useCard
    ? buildCardContentSection(innerHtml, theme)
    : buildFlowContentSection(innerHtml, theme);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(pageTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:${parchment};">
  <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${parchment}" style="width:100%;background-color:${parchment};margin:0;padding:0;border-collapse:collapse;">
    <tr>
      <td align="center" bgcolor="${parchment}" style="padding:0 20px 56px;background-color:${parchment};">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:collapse;">

          ${mastheadRows}

          ${contentSection}

          <tr>
            <td height="40" bgcolor="${parchment}" style="height:40px;background-color:${parchment};font-size:1px;line-height:1px;">&nbsp;</td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`.trim();
}
