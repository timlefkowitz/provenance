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
  const { ink, wine } = theme;
  const ff = EMAIL_FONT_FAMILY;

  return (
    html
      .replace(/<h1(\s[^>]*)?>/gi, `<h1 style="margin:0 0 16px;font-family:${ff};font-size:32px;font-weight:600;color:${wine};line-height:1.2;">`)
      .replace(/<h2(\s[^>]*)?>/gi, `<h2 style="margin:0 0 16px;font-family:${ff};font-size:28px;font-weight:600;color:${wine};line-height:1.2;">`)
      .replace(/<h3(\s[^>]*)?>/gi, `<h3 style="margin:0 0 12px;font-size:22px;font-weight:600;color:${wine};line-height:1.2;">`)
      .replace(/<p(\s[^>]*)?>/gi, `<p style="margin:0 0 16px;color:${ink};">`)
      .replace(/<ul(\s[^>]*)?>/gi, `<ul style="margin:0 0 24px;padding-left:20px;color:${ink};">`)
      .replace(/<ol(\s[^>]*)?>/gi, `<ol style="margin:0 0 24px;padding-left:24px;color:${ink};">`)
      .replace(/<li(\s[^>]*)?>/gi, `<li style="margin-bottom:10px;">`)
      .replace(/<blockquote(\s[^>]*)?>/gi, `<blockquote style="margin:0 0 16px;padding-left:12px;border-left:3px solid ${wine};color:${ink};">`)
      .replace(/<hr(\s[^>]*)?>/gi, `<hr style="border:none;border-top:1px solid ${wine};margin:24px 0;" />`)
      .replace(/<a /gi, `<a style="color:${wine};font-weight:600;" `)
      .replace(/<strong(\s[^>]*)?>/gi, `<strong style="color:${ink};">`)
      .replace(/<em(\s[^>]*)?>/gi, `<em style="color:${ink};">`)
      .replace(/<code(\s[^>]*)?>/gi, `<code style="font-family:ui-monospace,monospace;background:${theme.parchment};padding:2px 4px;border-radius:3px;">`)
      .replace(/<pre(\s[^>]*)?>/gi, `<pre style="font-family:ui-monospace,monospace;background:${theme.parchment};padding:12px;overflow:auto;">`)
  );
}
