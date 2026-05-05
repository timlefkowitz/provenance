import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type { EmailTheme, EmailStyle } from '~/lib/email-layout';
import { 
  EMAIL_FONT_FAMILY, 
  EMAIL_FONT_SERIF,
  EDITORIAL_COLORS, 
  GALLERY_COLORS, 
  MINIMAL_COLORS 
} from '~/lib/email-layout';

marked.use({
  gfm: true,
  breaks: true,
});

/**
 * Convert markdown to sanitized HTML, then add inline styles for common tags (email clients).
 * Supports multiple visual styles: 'editorial', 'gallery', 'minimal', or default theme-based.
 */
export function renderMarkdownToEmailHtml(
  markdown: string, 
  theme: EmailTheme,
  style?: EmailStyle
): string {
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

  // Apply style-specific or default inline styles
  if (style === 'editorial') {
    return applyEditorialInlineStyles(cleaned);
  } else if (style === 'gallery') {
    return applyGalleryInlineStyles(cleaned);
  } else if (style === 'minimal') {
    return applyMinimalInlineStyles(cleaned);
  }
  return applyEmailInlineStyles(cleaned, theme);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DEFAULT STYLE (Original)
 * ═══════════════════════════════════════════════════════════════════════════ */

function applyEmailInlineStyles(html: string, theme: EmailTheme): string {
  const { ink, wine, inkMuted } = theme;
  const ff = EMAIL_FONT_FAMILY;

  return (
    html
      .replace(/<h1(\s[^>]*)?>/gi, `<h1 style="margin:0 0 18px;font-family:${ff};font-size:26px;font-weight:700;color:${wine};line-height:1.25;letter-spacing:-0.01em;">`)
      .replace(/<h2(\s[^>]*)?>/gi, `<h2 style="margin:0 0 18px;font-family:${ff};font-size:22px;font-weight:700;color:${wine};line-height:1.25;letter-spacing:-0.01em;">`)
      .replace(/<h3(\s[^>]*)?>/gi, `<h3 style="margin:0 0 12px;font-family:${ff};font-size:17px;font-weight:600;color:${wine};line-height:1.3;">`)
      .replace(/<p(\s[^>]*)?>/gi, `<p style="margin:0 0 18px;font-family:${ff};font-size:16px;line-height:1.75;color:${ink};">`)
      .replace(/<ul(\s[^>]*)?>/gi, `<ul style="margin:0 0 24px;padding-left:20px;color:${ink};">`)
      .replace(/<ol(\s[^>]*)?>/gi, `<ol style="margin:0 0 24px;padding-left:24px;color:${ink};">`)
      .replace(/<li(\s[^>]*)?>/gi, `<li style="margin-bottom:10px;font-size:16px;line-height:1.65;color:${ink};">`)
      .replace(/<blockquote(\s[^>]*)?>/gi, `<blockquote style="margin:0 0 20px;padding:16px 20px;border-left:3px solid ${wine};background-color:#F9F6F0;color:${inkMuted};">`)
      .replace(/<hr(\s[^>]*)?\/?>(\s*)?/gi, `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0 36px;border-collapse:collapse;"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto;"><tr><td width="40" height="1" bgcolor="#D6D0C8" style="width:40px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td><td width="14" align="center" style="padding:0 5px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;"><tr><td width="4" height="4" bgcolor="${wine}" style="width:4px;height:4px;border-radius:50%;line-height:1px;font-size:1px;">&nbsp;</td></tr></table></td><td width="40" height="1" bgcolor="#D6D0C8" style="width:40px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td></tr></table></td></tr></table>`)
      .replace(/<a /gi, `<a style="color:${wine};font-weight:600;text-decoration:underline;" `)
      .replace(/<strong(\s[^>]*)?>/gi, `<strong style="font-weight:700;color:${ink};">`)
      .replace(/<em(\s[^>]*)?>/gi, `<em style="font-style:italic;color:${ink};">`)
      .replace(/<code(\s[^>]*)?>/gi, `<code style="font-family:ui-monospace,'Courier New',monospace;font-size:14px;background-color:#F5F1E8;padding:2px 5px;border-radius:2px;color:${wine};">`)
      .replace(/<pre(\s[^>]*)?>/gi, `<pre style="font-family:ui-monospace,'Courier New',monospace;font-size:13px;background-color:#F5F1E8;padding:16px 20px;overflow:auto;border-left:3px solid ${wine};">`)
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * EDITORIAL STYLE
 * Bold, magazine-inspired with dramatic typography on dark background
 * ═══════════════════════════════════════════════════════════════════════════ */

function applyEditorialInlineStyles(html: string): string {
  const { accent, text, textMuted, border } = EDITORIAL_COLORS;
  const ff = EMAIL_FONT_FAMILY;

  return (
    html
      // Dramatic oversized H1 - the hero moment
      .replace(/<h1(\s[^>]*)?>/gi, `<h1 class="editorial-hero" style="margin:0 0 32px;font-family:${ff};font-size:44px;font-weight:800;color:${text};line-height:1.05;letter-spacing:-0.03em;">`)
      // Strong H2 with accent underline effect
      .replace(/<h2(\s[^>]*)?>/gi, `<h2 style="margin:40px 0 20px;font-family:${ff};font-size:20px;font-weight:700;color:${accent};line-height:1.3;letter-spacing:0.02em;text-transform:uppercase;">`)
      // Subtle H3
      .replace(/<h3(\s[^>]*)?>/gi, `<h3 style="margin:32px 0 12px;font-family:${ff};font-size:16px;font-weight:600;color:${text};line-height:1.4;letter-spacing:0.01em;">`)
      // Body copy - clean and readable
      .replace(/<p(\s[^>]*)?>/gi, `<p style="margin:0 0 20px;font-family:${ff};font-size:16px;line-height:1.7;color:${text};">`)
      // Lists with accent bullets
      .replace(/<ul(\s[^>]*)?>/gi, `<ul style="margin:0 0 28px;padding-left:0;list-style:none;">`)
      .replace(/<ol(\s[^>]*)?>/gi, `<ol style="margin:0 0 28px;padding-left:24px;color:${text};">`)
      .replace(/<li(\s[^>]*)?>/gi, `<li style="margin-bottom:12px;padding-left:20px;font-size:16px;line-height:1.6;color:${text};position:relative;"><span style="position:absolute;left:0;color:${accent};font-weight:700;">&bull;</span>`)
      // Blockquote - editorial pull quote style
      .replace(/<blockquote(\s[^>]*)?>/gi, `<blockquote style="margin:32px 0;padding:0 0 0 24px;border-left:3px solid ${accent};font-size:18px;font-style:italic;color:${textMuted};">`)
      // Minimal divider
      .replace(/<hr(\s[^>]*)?\/?>(\s*)?/gi, `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:40px 0;border-collapse:collapse;"><tr><td width="60" height="2" bgcolor="${accent}" style="width:60px;height:2px;line-height:2px;font-size:1px;">&nbsp;</td></tr></table>`)
      // Links with accent color
      .replace(/<a /gi, `<a style="color:${accent};font-weight:600;text-decoration:none;border-bottom:1px solid ${accent};" `)
      .replace(/<strong(\s[^>]*)?>/gi, `<strong style="font-weight:700;color:${text};">`)
      .replace(/<em(\s[^>]*)?>/gi, `<em style="font-style:italic;color:${textMuted};">`)
      .replace(/<code(\s[^>]*)?>/gi, `<code style="font-family:ui-monospace,monospace;font-size:14px;background-color:${border};padding:3px 6px;color:${accent};">`)
      .replace(/<pre(\s[^>]*)?>/gi, `<pre style="font-family:ui-monospace,monospace;font-size:13px;background-color:${border};padding:20px;overflow:auto;color:${text};">`)
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * GALLERY STYLE
 * Refined, museum-quality with elegant serif typography
 * ═══════════════════════════════════════════════════════════════════════════ */

function applyGalleryInlineStyles(html: string): string {
  const { accent, accentSecondary, text, textMuted, divider } = GALLERY_COLORS;
  const ff = EMAIL_FONT_SERIF;

  return (
    html
      // Elegant serif headings with refined spacing
      .replace(/<h1(\s[^>]*)?>/gi, `<h1 style="margin:0 0 28px;font-family:${ff};font-size:32px;font-weight:400;color:${accent};line-height:1.2;letter-spacing:0.02em;">`)
      .replace(/<h2(\s[^>]*)?>/gi, `<h2 style="margin:36px 0 20px;font-family:${ff};font-size:22px;font-weight:400;color:${accent};line-height:1.3;letter-spacing:0.01em;">`)
      .replace(/<h3(\s[^>]*)?>/gi, `<h3 style="margin:28px 0 14px;font-family:${ff};font-size:18px;font-weight:600;color:${accentSecondary};line-height:1.4;font-style:italic;">`)
      // Generous, readable body copy
      .replace(/<p(\s[^>]*)?>/gi, `<p style="margin:0 0 22px;font-family:${ff};font-size:17px;line-height:1.8;color:${text};">`)
      // Refined lists
      .replace(/<ul(\s[^>]*)?>/gi, `<ul style="margin:0 0 28px;padding-left:24px;color:${text};">`)
      .replace(/<ol(\s[^>]*)?>/gi, `<ol style="margin:0 0 28px;padding-left:28px;color:${text};">`)
      .replace(/<li(\s[^>]*)?>/gi, `<li style="margin-bottom:14px;font-size:17px;line-height:1.7;color:${text};">`)
      // Elegant blockquote with serif italic
      .replace(/<blockquote(\s[^>]*)?>/gi, `<blockquote style="margin:28px 0;padding:24px 28px;border-left:2px solid ${accentSecondary};background-color:#FDFCFA;font-size:18px;font-style:italic;color:${textMuted};">`)
      // Ornamental divider with diamond
      .replace(/<hr(\s[^>]*)?\/?>(\s*)?/gi, `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:36px 0;border-collapse:collapse;"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto;"><tr><td width="48" height="1" bgcolor="${divider}" style="width:48px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td><td width="20" align="center" style="padding:0 10px;"><span style="font-family:${ff};font-size:14px;color:${accentSecondary};">&loz;</span></td><td width="48" height="1" bgcolor="${divider}" style="width:48px;height:1px;line-height:1px;font-size:1px;">&nbsp;</td></tr></table></td></tr></table>`)
      // Elegant links
      .replace(/<a /gi, `<a style="color:${accent};text-decoration:underline;text-underline-offset:3px;" `)
      .replace(/<strong(\s[^>]*)?>/gi, `<strong style="font-weight:600;color:${accent};">`)
      .replace(/<em(\s[^>]*)?>/gi, `<em style="font-style:italic;color:${text};">`)
      .replace(/<code(\s[^>]*)?>/gi, `<code style="font-family:ui-monospace,monospace;font-size:15px;background-color:#F5F3EF;padding:2px 6px;color:${accentSecondary};">`)
      .replace(/<pre(\s[^>]*)?>/gi, `<pre style="font-family:ui-monospace,monospace;font-size:14px;background-color:#F5F3EF;padding:20px 24px;overflow:auto;border-left:2px solid ${accentSecondary};">`)
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * MINIMAL STYLE  
 * Clean, warm, friendly with modern sans-serif
 * ═══════════════════════════════════════════════════════════════════════════ */

function applyMinimalInlineStyles(html: string): string {
  const { accent, accentLight, text, textMuted, border } = MINIMAL_COLORS;
  const ff = EMAIL_FONT_FAMILY;

  return (
    html
      // Friendly, approachable headings
      .replace(/<h1(\s[^>]*)?>/gi, `<h1 style="margin:0 0 24px;font-family:${ff};font-size:28px;font-weight:700;color:${text};line-height:1.25;">`)
      .replace(/<h2(\s[^>]*)?>/gi, `<h2 style="margin:32px 0 16px;font-family:${ff};font-size:20px;font-weight:600;color:${accent};line-height:1.35;">`)
      .replace(/<h3(\s[^>]*)?>/gi, `<h3 style="margin:24px 0 12px;font-family:${ff};font-size:17px;font-weight:600;color:${text};line-height:1.4;">`)
      // Clean, comfortable body copy
      .replace(/<p(\s[^>]*)?>/gi, `<p style="margin:0 0 18px;font-family:${ff};font-size:16px;line-height:1.7;color:${text};">`)
      // Simple, clean lists
      .replace(/<ul(\s[^>]*)?>/gi, `<ul style="margin:0 0 24px;padding-left:20px;color:${text};">`)
      .replace(/<ol(\s[^>]*)?>/gi, `<ol style="margin:0 0 24px;padding-left:24px;color:${text};">`)
      .replace(/<li(\s[^>]*)?>/gi, `<li style="margin-bottom:10px;font-size:16px;line-height:1.65;color:${text};">`)
      // Soft, friendly blockquote
      .replace(/<blockquote(\s[^>]*)?>/gi, `<blockquote style="margin:24px 0;padding:20px 24px;border-radius:8px;background-color:${accentLight};font-size:16px;color:${text};">`)
      // Simple line divider
      .replace(/<hr(\s[^>]*)?\/?>(\s*)?/gi, `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0;border-collapse:collapse;"><tr><td height="1" bgcolor="${border}" style="height:1px;line-height:1px;font-size:1px;">&nbsp;</td></tr></table>`)
      // Clean accent links
      .replace(/<a /gi, `<a style="color:${accent};font-weight:500;text-decoration:underline;text-underline-offset:2px;" `)
      .replace(/<strong(\s[^>]*)?>/gi, `<strong style="font-weight:600;color:${text};">`)
      .replace(/<em(\s[^>]*)?>/gi, `<em style="font-style:italic;color:${textMuted};">`)
      .replace(/<code(\s[^>]*)?>/gi, `<code style="font-family:ui-monospace,monospace;font-size:14px;background-color:${accentLight};padding:2px 6px;border-radius:4px;color:${accent};">`)
      .replace(/<pre(\s[^>]*)?>/gi, `<pre style="font-family:ui-monospace,monospace;font-size:14px;background-color:${accentLight};padding:20px;border-radius:8px;overflow:auto;">`)
  );
}
