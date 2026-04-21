import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type { EmailTheme } from '~/lib/email-layout';
import { EMAIL_FONT_FAMILY } from '~/lib/email-layout';

marked.use({
  gfm: true,
  breaks: true,
});

/**
 * Convert markdown to sanitized HTML, then add inline styles for common tags (email clients).
 */
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
  const { ink, wine, inkMuted } = theme;
  const ff = EMAIL_FONT_FAMILY;

  return (
    html
      // Scaled-down heading hierarchy — 32px felt too large alongside the refined masthead
      .replace(/<h1(\s[^>]*)?>/gi, `<h1 style="margin:0 0 18px;font-family:${ff};font-size:26px;font-weight:700;color:${wine};line-height:1.25;letter-spacing:-0.01em;">`)
      .replace(/<h2(\s[^>]*)?>/gi, `<h2 style="margin:0 0 18px;font-family:${ff};font-size:22px;font-weight:700;color:${wine};line-height:1.25;letter-spacing:-0.01em;">`)
      .replace(/<h3(\s[^>]*)?>/gi, `<h3 style="margin:0 0 12px;font-family:${ff};font-size:17px;font-weight:600;color:${wine};line-height:1.3;">`)
      // Generous line-height on body copy for comfortable reading
      .replace(/<p(\s[^>]*)?>/gi, `<p style="margin:0 0 18px;font-family:${ff};font-size:16px;line-height:1.75;color:${ink};">`)
      .replace(/<ul(\s[^>]*)?>/gi, `<ul style="margin:0 0 24px;padding-left:20px;color:${ink};">`)
      .replace(/<ol(\s[^>]*)?>/gi, `<ol style="margin:0 0 24px;padding-left:24px;color:${ink};">`)
      .replace(/<li(\s[^>]*)?>/gi, `<li style="margin-bottom:10px;font-size:16px;line-height:1.65;color:${ink};">`)
      .replace(/<blockquote(\s[^>]*)?>/gi, `<blockquote style="margin:0 0 20px;padding:16px 20px;border-left:3px solid ${wine};background-color:#F9F6F0;color:${inkMuted};">`)
      // Ornamental divider — matches the masthead ornament motif
      .replace(/<hr(\s[^>]*)?\/?>(\s*)?/gi, `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0 36px;border-collapse:collapse;"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto;"><tr><td width="40" height="1" bgcolor="#D6D0C8" style="width:40px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td><td width="14" align="center" style="padding:0 5px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;"><tr><td width="4" height="4" bgcolor="${wine}" style="width:4px;height:4px;border-radius:50%;line-height:1px;font-size:1px;">&nbsp;</td></tr></table></td><td width="40" height="1" bgcolor="#D6D0C8" style="width:40px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td></tr></table></td></tr></table>`)
      .replace(/<a /gi, `<a style="color:${wine};font-weight:600;text-decoration:underline;" `)
      .replace(/<strong(\s[^>]*)?>/gi, `<strong style="font-weight:700;color:${ink};">`)
      .replace(/<em(\s[^>]*)?>/gi, `<em style="font-style:italic;color:${ink};">`)
      .replace(/<code(\s[^>]*)?>/gi, `<code style="font-family:ui-monospace,'Courier New',monospace;font-size:14px;background-color:#F5F1E8;padding:2px 5px;border-radius:2px;color:${wine};">`)
      .replace(/<pre(\s[^>]*)?>/gi, `<pre style="font-family:ui-monospace,'Courier New',monospace;font-size:13px;background-color:#F5F1E8;padding:16px 20px;overflow:auto;border-left:3px solid ${wine};">`)
  );
}
