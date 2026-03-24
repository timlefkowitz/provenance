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

export function buildEmailMastheadRows(theme: EmailTheme): string {
  const { wine, inkSubtitle, parchment, fontFamily, mastheadTitle, mastheadSubtitle } = theme;
  return `
  <tr>
    <td align="center" style="padding: 40px 24px 12px; background-color: ${parchment};">
      <span style="display: block; font-family: ${fontFamily}; font-size: 52px; line-height: 1.05; font-weight: 700; letter-spacing: -0.03em; color: ${wine}; text-align: center;">
        ${escapeHtml(mastheadTitle)}
      </span>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding: 0 24px 28px; background-color: ${parchment};">
      <span style="display: block; font-family: ${fontFamily}; font-size: 22px; line-height: 1.35; font-weight: 300; letter-spacing: -0.02em; color: ${inkSubtitle}; text-align: center;">
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
</head>
<body style="margin: 0; padding: 0; background-color: ${parchment};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${parchment}" style="width: 100%; background-color: ${parchment}; margin: 0; padding: 0; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 24px 16px 40px; background-color: ${parchment};">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${parchment}" style="width: 100%; max-width: 600px; background-color: ${parchment}; border-collapse: collapse;">
          ${buildEmailMastheadRows(theme)}
          <tr>
            <td align="left" style="padding: 0 16px 24px; font-family: ${fontFamily}; font-size: 16px; line-height: 1.6; color: ${ink}; background-color: ${parchment};">
              ${innerHtml}
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
