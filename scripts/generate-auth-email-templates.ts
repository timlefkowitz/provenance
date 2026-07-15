#!/usr/bin/env tsx
/**
 * Generates the 5 Supabase auth email templates (magic-link, confirm-email,
 * reset-password, invite-user, change-email-address) for a chosen design preset.
 *
 * Usage:
 *   pnpm email:gen-auth                   # default: atelier
 *   pnpm email:gen-auth atelier
 *   pnpm email:gen-auth gallery
 *   pnpm email:gen-auth midnight
 *
 * The generated files overwrite the static HTML in:
 *   makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/templates/
 *
 * Supabase Go template variables ({{ .SiteURL }}, {{ .TokenHash }}, etc.) are
 * injected as raw strings — NOT HTML-escaped — so they round-trip correctly.
 *
 * After changing the style, commit the regenerated files and redeploy.
 * The admin picker at /admin/emails controls Resend emails at runtime;
 * auth emails require this generator + a redeploy to change style.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
import {
  EMAIL_LAYOUT_PRESET_IDS,
  EMAIL_THEMES,
  normalizeEmailLayoutPreset,
} from '../src/lib/email-layout-presets';
import type { EmailTheme } from '../src/lib/email-layout';
import {
  buildEmailMastheadRows,
  buildEmailFooterHtml,
  escapeHtml,
  getPublicSiteUrlForEmail,
} from '../src/lib/email-layout';

// ── Supabase Go template vars (NOT HTML-escaped) ───────────────────────────

const SB = {
  siteUrl:     '{{ .SiteURL }}',
  tokenHash:   '{{ .TokenHash }}',
  redirectTo:  '{{ .RedirectTo }}',
  email:       '{{ .Email }}',
  newEmail:    '{{ .NewEmail }}',
  inviterName: '{{ .Data.inviter_name }}',
} as const;

// ── Shared shell with support for raw (unescaped) Supabase vars ────────────

function buildAuthEmailHtml(
  pageTitle: string,
  innerHtml: string,
  theme: EmailTheme,
): string {
  const { parchment, cardBg, cardBorder, fontFamily, ink, wine, cardRadius, accentBarHeight } = theme;
  const mastheadRows = buildEmailMastheadRows(theme);

  let contentSection: string;

  if (theme.useCard) {
    const gapPadding = theme.mastheadVariant === 'hero' ? '8px 0 0' : '20px 0 0';
    const accentBar =
      accentBarHeight > 0
        ? `<tr><td height="${accentBarHeight}" bgcolor="${wine}" style="height:${accentBarHeight}px;line-height:${accentBarHeight}px;font-size:1px;background-color:${wine};border-radius:${cardRadius} ${cardRadius} 0 0;">&nbsp;</td></tr>`
        : '';
    contentSection = `
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
  } else {
    contentSection = `
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

  return `<!DOCTYPE html>
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
</html>`;
}

// ── Bulletproof CTA button (raw href — not HTML-escaped) ───────────────────

function buildAuthButton(rawHref: string, label: string, theme: EmailTheme): string {
  const { wine, accentText, fontFamily, buttonRadius, buttonTextTransform } = theme;
  const textTransformCss = buttonTextTransform === 'uppercase' ? 'text-transform:uppercase;' : '';
  const letterSpacing    = buttonTextTransform === 'uppercase' ? '0.08em' : '0.02em';
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0 8px;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td align="center" bgcolor="${wine}" style="background-color:${wine};border-radius:${buttonRadius};border:1px solid ${wine};mso-padding-alt:0;">
            <!--[if !mso]><!-- -->
            <a href="${rawHref}" target="_blank" style="display:inline-block;background-color:${wine};border-radius:${buttonRadius};padding:14px 32px;font-family:${fontFamily};font-size:14px;font-weight:700;letter-spacing:${letterSpacing};${textTransformCss}line-height:1.2;color:${accentText};text-decoration:none;text-align:center;-webkit-text-size-adjust:none;">${label}</a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

function fallbackLink(rawHref: string, theme: EmailTheme): string {
  const { fontFamily, ink, wine } = theme;
  return `<p style="margin:16px 0 0;font-family:${fontFamily};font-size:13px;line-height:1.6;color:${ink};">Or copy this URL into your browser:<br><a href="${rawHref}" style="color:${wine};text-decoration:none;word-break:break-all;">${rawHref}</a></p>`;
}

// ── Template content builders ──────────────────────────────────────────────

function buildMagicLink(theme: EmailTheme): string {
  const { fontFamily, ink, wine, inkMuted } = theme;
  const href = `${SB.siteUrl}/auth/confirm?token_hash=${SB.tokenHash}&type=magiclink&callback=${SB.redirectTo}`;
  return buildAuthEmailHtml('Sign in to Provenance', `
<h1 style="margin:0 0 20px;font-family:${theme.fontFamilyHeading};font-size:26px;font-weight:700;color:${ink};line-height:1.25;">Sign in to Provenance</h1>
<p style="margin:0 0 8px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};">Use the button below to sign in. This link expires soon.</p>
${buildAuthButton(href, 'Sign in', theme)}
${fallbackLink(href, theme)}
<p style="margin:24px 0 0;font-family:${fontFamily};font-size:13px;line-height:1.6;color:${inkMuted};">If you didn't request this, you can safely ignore this email.</p>
`.trim(), theme);
}

function buildConfirmEmail(theme: EmailTheme): string {
  const { fontFamily, ink } = theme;
  const href = `${SB.siteUrl}/auth/confirm?token_hash=${SB.tokenHash}&type=email`;
  return buildAuthEmailHtml('Confirm your email', `
<h1 style="margin:0 0 20px;font-family:${theme.fontFamilyHeading};font-size:26px;font-weight:700;color:${ink};line-height:1.25;">Confirm your email address</h1>
<p style="margin:0 0 8px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};">Click the button below to confirm your email address and activate your account.</p>
${buildAuthButton(href, 'Confirm email', theme)}
${fallbackLink(href, theme)}
`.trim(), theme);
}

function buildResetPassword(theme: EmailTheme): string {
  const { fontFamily, ink } = theme;
  const href = `${SB.siteUrl}/auth/confirm?token_hash=${SB.tokenHash}&type=recovery&next=/update-password`;
  return buildAuthEmailHtml('Reset your password', `
<h1 style="margin:0 0 20px;font-family:${theme.fontFamilyHeading};font-size:26px;font-weight:700;color:${ink};line-height:1.25;">Reset your password</h1>
<p style="margin:0 0 8px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};">Click the button below to choose a new password. This link expires in 24 hours.</p>
${buildAuthButton(href, 'Reset password', theme)}
${fallbackLink(href, theme)}
`.trim(), theme);
}

function buildInviteUser(theme: EmailTheme): string {
  const { fontFamily, ink } = theme;
  const href = `${SB.siteUrl}/auth/confirm?token_hash=${SB.tokenHash}&type=invite&next=/auth/set-password`;
  return buildAuthEmailHtml("You're invited to Provenance", `
<h1 style="margin:0 0 20px;font-family:${theme.fontFamilyHeading};font-size:26px;font-weight:700;color:${ink};line-height:1.25;">You&rsquo;re invited to Provenance</h1>
<p style="margin:0 0 8px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};">You&rsquo;ve been invited to join Provenance. Click the button below to set up your account.</p>
${buildAuthButton(href, 'Accept invitation', theme)}
${fallbackLink(href, theme)}
`.trim(), theme);
}

function buildChangeEmail(theme: EmailTheme): string {
  const { fontFamily, ink } = theme;
  const href = `${SB.siteUrl}/auth/confirm?token_hash=${SB.tokenHash}&type=email_change`;
  return buildAuthEmailHtml('Confirm your email change', `
<h1 style="margin:0 0 20px;font-family:${theme.fontFamilyHeading};font-size:26px;font-weight:700;color:${ink};line-height:1.25;">Confirm your email change</h1>
<p style="margin:0 0 8px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};">Click the button below to confirm your new email address: <strong style="color:${ink};">${SB.newEmail}</strong></p>
${buildAuthButton(href, 'Confirm email change', theme)}
${fallbackLink(href, theme)}
`.trim(), theme);
}

// ── Write all 5 templates ─────────────────────────────────────────────────

const TEMPLATE_DIR = path.join(
  __dirname,
  '../makerkit/nextjs-saas-starter-kit-lite/apps/web/supabase/templates',
);

const TEMPLATES: Array<{ file: string; builder: (t: EmailTheme) => string }> = [
  { file: 'magic-link.html',           builder: buildMagicLink     },
  { file: 'confirm-email.html',        builder: buildConfirmEmail   },
  { file: 'reset-password.html',       builder: buildResetPassword  },
  { file: 'invite-user.html',          builder: buildInviteUser     },
  { file: 'change-email-address.html', builder: buildChangeEmail    },
];

// ── Main ──────────────────────────────────────────────────────────────────

const rawArg = process.argv[2];
const presetId = normalizeEmailLayoutPreset(rawArg ?? 'atelier');
const theme    = EMAIL_THEMES[presetId];

if (rawArg && !EMAIL_LAYOUT_PRESET_IDS.includes(rawArg as typeof EMAIL_LAYOUT_PRESET_IDS[number])) {
  console.warn(`\nUnknown preset "${rawArg}". Valid presets: ${EMAIL_LAYOUT_PRESET_IDS.join(', ')}`);
  console.warn(`Falling back to "atelier".\n`);
}

console.log(`\nGenerating auth email templates — preset: ${presetId}`);
console.log(`Output directory: ${TEMPLATE_DIR}\n`);

if (!fs.existsSync(TEMPLATE_DIR)) {
  console.error(`Template directory not found: ${TEMPLATE_DIR}`);
  process.exit(1);
}

for (const { file, builder } of TEMPLATES) {
  const html     = builder(theme);
  const filePath = path.join(TEMPLATE_DIR, file);
  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`  ✓ ${file}`);
}

console.log(`\nDone. Commit the updated files and redeploy to apply the "${presetId}" style to auth emails.\n`);
