import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type { EmailTheme } from '~/lib/email-layout';
import { EMAIL_FONT_FAMILY_FALLBACK } from '~/lib/email-layout';

marked.use({
  gfm: true,
  breaks: true,
});

export function renderMarkdownToEmailHtml(markdown: string, theme: EmailTheme): string {
  const raw = marked.parse(markdown, { async: false });
  if (typeof raw !== 'string') {
    throw new Error('[Email] marked.parse returned non-string');
  }

  const cleaned = sanitizeHtml(raw, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'p',
      'br',
      'ul',
      'ol',
      'li',
      'a',
      'strong',
      'em',
      'code',
      'pre',
      'blockquote',
      'hr',
      'div',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'style'],
      div: ['style'],
      span: ['style'],
      code: ['style'],
      pre: ['style'],
      p: ['style'],
      ul: ['style'],
      ol: ['style'],
      li: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      blockquote: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
  });

  return applyEmailInlineStyles(cleaned, theme);
}

function applyEmailInlineStyles(html: string, theme: EmailTheme): string {
  const { ink, wine, inkMuted, surfaceMuted, footerRule } = theme;
  const ffHeading = theme.fontFamilyHeading || EMAIL_FONT_FAMILY_FALLBACK;
  const ffBody = theme.fontFamily || EMAIL_FONT_FAMILY_FALLBACK;
  const hrMuted = footerRule || '#E5E5E5';
  const bqBg = surfaceMuted;

  return (
    html
      .replace(
        /<h1(\s[^>]*)?>/gi,
        `<h1 style="margin:0 0 20px;font-family:${ffHeading};font-size:26px;font-weight:700;color:${ink};line-height:1.25;letter-spacing:-0.01em;">`,
      )
      .replace(
        /<h2(\s[^>]*)?>/gi,
        `<h2 style="margin:0 0 16px;font-family:${ffHeading};font-size:21px;font-weight:600;color:${wine};line-height:1.3;letter-spacing:-0.01em;">`,
      )
      .replace(
        /<h3(\s[^>]*)?>/gi,
        `<h3 style="margin:0 0 12px;font-family:${ffHeading};font-size:17px;font-weight:600;color:${ink};line-height:1.4;">`,
      )
      .replace(
        /<p(\s[^>]*)?>/gi,
        `<p style="margin:0 0 16px;font-family:${ffBody};font-size:16px;line-height:1.7;color:${ink};">`,
      )
      .replace(/<ul(\s[^>]*)?>/gi, `<ul style="margin:0 0 20px;padding-left:20px;color:${ink};">`)
      .replace(/<ol(\s[^>]*)?>/gi, `<ol style="margin:0 0 20px;padding-left:24px;color:${ink};">`)
      .replace(
        /<li(\s[^>]*)?>/gi,
        `<li style="margin-bottom:8px;font-family:${ffBody};font-size:16px;line-height:1.65;color:${ink};">`,
      )
      .replace(
        /<blockquote(\s[^>]*)?>/gi,
        `<blockquote style="margin:0 0 20px;padding:16px 20px;border-left:2px solid ${wine};background-color:${bqBg};color:${inkMuted};font-family:${ffBody};">`,
      )
      .replace(
        /<hr(\s[^>]*)?\/?>(\s*)?/gi,
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 32px;border-collapse:collapse;"><tr><td height="1" bgcolor="${hrMuted}" style="height:1px;line-height:1px;font-size:1px;background-color:${hrMuted};">&nbsp;</td></tr></table>`,
      )
      .replace(
        /<a /gi,
        `<a style="color:${wine};font-weight:500;text-decoration:none;font-family:inherit;" `,
      )
      .replace(/<strong(\s[^>]*)?>/gi, `<strong style="font-weight:600;color:${ink};font-family:inherit;">`)
      .replace(/<em(\s[^>]*)?>/gi, `<em style="font-style:italic;color:${ink};font-family:inherit;">`)
      .replace(
        /<code(\s[^>]*)?>/gi,
        `<code style="font-family:ui-monospace,'Courier New',monospace;font-size:14px;background-color:${bqBg};padding:2px 6px;border-radius:4px;color:${ink};">`,
      )
      .replace(
        /<pre(\s[^>]*)?>/gi,
        `<pre style="font-family:ui-monospace,'Courier New',monospace;font-size:13px;background-color:${bqBg};padding:16px 20px;overflow:auto;border-radius:6px;">`,
      )
  );
}
