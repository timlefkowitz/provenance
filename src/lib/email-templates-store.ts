import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import type { EmailTheme } from '~/lib/email-layout';
import { EMAIL_FONT_FAMILY, buildEmailHtml, escapeHtml } from '~/lib/email-layout';
import { renderMarkdownToEmailHtml } from '~/lib/email-markdown';
import {
  DEFAULT_EMAIL_MARKDOWN,
  DEFAULT_EMAIL_SUBJECTS,
  type EmailTemplateKey,
} from '~/lib/email-defaults';
import type { SummaryItem } from '~/lib/email-defaults';

export const DEFAULT_EMAIL_THEME: EmailTheme = {
  parchment: '#F5F1E8',
  ink: '#111111',
  wine: '#4A2F25',
  inkSubtitle: '#2a2a2a',
  inkMuted: '#555555',
  mastheadTitle: 'PROVENANCE',
  mastheadSubtitle: 'PRESERVING CULTURAL HERITAGE',
  fontFamily: EMAIL_FONT_FAMILY,
};

type EmailSettingsRow = {
  parchment: string;
  ink: string;
  wine: string;
  ink_subtitle: string;
  ink_muted: string;
  masthead_title: string;
  masthead_subtitle: string;
};

function mapSettingsRow(row: EmailSettingsRow): EmailTheme {
  return {
    parchment: row.parchment || DEFAULT_EMAIL_THEME.parchment,
    ink: row.ink || DEFAULT_EMAIL_THEME.ink,
    wine: row.wine || DEFAULT_EMAIL_THEME.wine,
    inkSubtitle: row.ink_subtitle || DEFAULT_EMAIL_THEME.inkSubtitle,
    inkMuted: row.ink_muted || DEFAULT_EMAIL_THEME.inkMuted,
    mastheadTitle: row.masthead_title || DEFAULT_EMAIL_THEME.mastheadTitle,
    mastheadSubtitle: row.masthead_subtitle || DEFAULT_EMAIL_THEME.mastheadSubtitle,
    fontFamily: EMAIL_FONT_FAMILY,
  };
}

export async function getResolvedEmailTheme(): Promise<EmailTheme> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables not in generated DB types yet
    const admin = getSupabaseServerAdminClient() as any;
    const { data, error } = await admin.from('email_settings').select('*').limit(1).maybeSingle();

    if (error) {
      console.error('[Email] email_settings read failed', error);
      return DEFAULT_EMAIL_THEME;
    }
    if (!data) {
      return DEFAULT_EMAIL_THEME;
    }
    return mapSettingsRow(data as EmailSettingsRow);
  } catch (err) {
    console.error('[Email] email_settings load error', err);
    return DEFAULT_EMAIL_THEME;
  }
}

export async function getResolvedTemplateMarkdown(key: EmailTemplateKey): Promise<{
  subject: string;
  bodyMarkdown: string;
}> {
  const fallbackSubject = DEFAULT_EMAIL_SUBJECTS[key];
  const fallbackMd = DEFAULT_EMAIL_MARKDOWN[key];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables not in generated DB types yet
    const admin = getSupabaseServerAdminClient() as any;
    const { data, error } = await admin
      .from('email_templates')
      .select('subject, body_markdown')
      .eq('template_key', key)
      .maybeSingle();

    if (error) {
      console.error('[Email] email_templates read failed', key, error);
      return { subject: fallbackSubject, bodyMarkdown: fallbackMd };
    }
    if (!data?.body_markdown) {
      return { subject: data?.subject || fallbackSubject, bodyMarkdown: fallbackMd };
    }
    return {
      subject: data.subject || fallbackSubject,
      bodyMarkdown: data.body_markdown as string,
    };
  } catch (err) {
    console.error('[Email] email_templates load error', key, err);
    return { subject: fallbackSubject, bodyMarkdown: fallbackMd };
  }
}

function buildCertBlockHtml(theme: EmailTheme, certificateNumber: string): string {
  const safe = escapeHtml(certificateNumber);
  return `<div style="background-color:#ebe6dc;border-left:4px solid ${theme.wine};padding:20px;margin:24px 0;border-radius:4px;">
  <p style="margin:0;font-size:14px;color:${theme.inkMuted};margin-bottom:8px;"><strong>Certificate Number:</strong></p>
  <p style="margin:0;font-size:20px;color:${theme.wine};font-weight:600;font-family:ui-monospace,monospace;">${safe}</p>
</div>`;
}

function buildItemsHtml(theme: EmailTheme, items: SummaryItem[]): string {
  const lines = items
    .map((item) => {
      const t = escapeHtml(item.title);
      const d = item.description ? `<br /><span style="font-size:14px;color:${theme.inkMuted};">${escapeHtml(item.description)}</span>` : '';
      return `<li style="margin-bottom:16px;"><strong style="color:${theme.wine};">${t}</strong>${d}</li>`;
    })
    .join('');
  return `<ul style="font-size:16px;margin:0 0 30px;padding-left:20px;list-style:none;color:${theme.ink};">${lines}</ul>`;
}

/**
 * Replace placeholders. Use `raw` for URLs and pre-built HTML (not HTML-escaped).
 * Use `escaped` for user-visible text (HTML-escaped).
 */
function interpolateTemplate(
  md: string,
  escaped: Record<string, string>,
  raw: Record<string, string>,
): string {
  let out = md;
  for (const [k, v] of Object.entries(raw)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  for (const [k, v] of Object.entries(escaped)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

function isSafeHttpUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return p.protocol === 'https:' || p.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function renderWelcomeEmailHtml(name: string): Promise<string> {
  const theme = await getResolvedEmailTheme();
  const { bodyMarkdown } = await getResolvedTemplateMarkdown('welcome');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
  const displayName = name || 'there';

  const md = interpolateTemplate(
    bodyMarkdown,
    { name: escapeHtml(displayName) },
    { siteUrl: isSafeHttpUrl(siteUrl) ? siteUrl : 'https://provenance.guru' },
  );

  const inner = `<div>${renderMarkdownToEmailHtml(md, theme)}</div>`;
  return buildEmailHtml('Welcome to Provenance', inner, theme);
}

export async function getWelcomeEmailSubject(): Promise<string> {
  const { subject } = await getResolvedTemplateMarkdown('welcome');
  return subject;
}

export async function renderCertificationEmailHtml(
  name: string,
  artworkTitle: string,
  certificateNumber: string,
  artworkUrl: string,
): Promise<string> {
  const theme = await getResolvedEmailTheme();
  const { bodyMarkdown } = await getResolvedTemplateMarkdown('certification');
  const safeTitle = escapeHtml(artworkTitle);
  const safeArtworkUrl = isSafeHttpUrl(artworkUrl) ? artworkUrl : 'https://provenance.guru';
  const certBlock = buildCertBlockHtml(theme, certificateNumber);

  const md = interpolateTemplate(
    bodyMarkdown,
    {
      name: escapeHtml(name || 'there'),
      artworkTitle: safeTitle,
    },
    {
      artworkUrl: safeArtworkUrl,
      CERT_BLOCK: certBlock,
    },
  );

  const inner = `<div>${renderMarkdownToEmailHtml(md, theme)}</div>`;
  return buildEmailHtml('Your Artwork Has Been Certified', inner, theme);
}

export async function getCertificationEmailSubject(artworkTitle: string): Promise<string> {
  const { subject } = await getResolvedTemplateMarkdown('certification');
  return subject.split('{{artworkTitle}}').join(artworkTitle);
}

export async function renderNotificationEmailHtml(
  name: string,
  title: string,
  body: string,
  ctaUrl?: string,
  ctaLabel?: string,
): Promise<string> {
  const theme = await getResolvedEmailTheme();
  const { bodyMarkdown } = await getResolvedTemplateMarkdown('notification');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
  const url = ctaUrl && isSafeHttpUrl(ctaUrl) ? ctaUrl : isSafeHttpUrl(siteUrl) ? siteUrl : 'https://provenance.guru';
  const label = ctaLabel || 'View';

  let md = interpolateTemplate(
    bodyMarkdown,
    {
      name: escapeHtml(name || 'there'),
      title: escapeHtml(title),
      body: escapeHtml(body).replace(/\r\n/g, '\n').replace(/\n/g, '\n\n'),
      ctaLabel: escapeHtml(label),
    },
    { ctaUrl: url },
  );

  if (!ctaUrl && !ctaLabel) {
    md = md.replace(/\n*\[([^\]]+)\]\([^)]+\)\n*/g, '\n');
  }

  const inner = `<div>${renderMarkdownToEmailHtml(md, theme)}</div>`;
  return buildEmailHtml(title, inner, theme);
}

export async function renderSummaryEmailHtml(
  name: string,
  items: SummaryItem[],
  period?: string,
): Promise<string> {
  const theme = await getResolvedEmailTheme();
  const { bodyMarkdown } = await getResolvedTemplateMarkdown('summary');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
  const periodLabel = period || 'Summary';

  const itemsHtml = buildItemsHtml(theme, items);
  const safeSite = isSafeHttpUrl(siteUrl) ? siteUrl : 'https://provenance.guru';

  const md = interpolateTemplate(
    bodyMarkdown,
    {
      name: escapeHtml(name || 'there'),
      periodLabel: escapeHtml(periodLabel),
    },
    {
      siteUrl: safeSite,
      ITEMS: itemsHtml,
    },
  );

  const inner = `<div>${renderMarkdownToEmailHtml(md, theme)}</div>`;
  return buildEmailHtml(`Your ${periodLabel}`, inner, theme);
}

export async function renderUpdateEmailHtml(
  name: string,
  title: string,
  body: string,
  link?: string,
  linkLabel?: string,
): Promise<string> {
  const theme = await getResolvedEmailTheme();
  const { bodyMarkdown } = await getResolvedTemplateMarkdown('update');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
  const url = link && isSafeHttpUrl(link) ? link : isSafeHttpUrl(siteUrl) ? siteUrl : 'https://provenance.guru';
  const label = linkLabel || 'Learn more';

  const md = interpolateTemplate(
    bodyMarkdown,
    {
      name: escapeHtml(name || 'there'),
      title: escapeHtml(title),
      body: escapeHtml(body).replace(/\r\n/g, '\n').replace(/\n/g, '\n\n'),
      ctaLabel: escapeHtml(label),
    },
    { ctaUrl: url },
  );

  const inner = `<div>${renderMarkdownToEmailHtml(md, theme)}</div>`;
  return buildEmailHtml(title, inner, theme);
}

/** Sample data for admin preview only — mirrors real sends without hitting the database. */
const PREVIEW_SAMPLE = {
  name: 'Alex Rivera',
  siteUrl: 'https://www.provenance.guru',
  artworkTitle: 'Evening Light (2024)',
  certificateNumber: 'PRV-2048-A7B2',
  artworkUrl: 'https://www.provenance.guru/artworks/sample-artwork',
  notificationTitle: 'Your gallery request was approved',
  notificationBody:
    'Congratulations — your gallery profile is now live. You can add exhibitions and invite artists from your dashboard.',
  ctaLabel: 'Open dashboard',
  ctaUrl: 'https://www.provenance.guru/registry',
  periodLabel: 'Weekly summary',
  updateTitle: 'New: verified collector badges',
  updateBody:
    'Collectors can now earn verified badges when they complete certain steps. This helps artists trust inbound inquiries.',
  updateLinkLabel: 'Read the announcement',
} as const;

const PREVIEW_SUMMARY_ITEMS: SummaryItem[] = [
  {
    title: 'New certificate: Evening Light',
    description: 'Your artwork was certified and is visible on your profile.',
  },
  {
    title: 'Exhibition invite',
    description: 'Gallery Row North invited you to participate in Spring Group Show.',
  },
];

/**
 * Build the same HTML shape as production sends, using the given theme + markdown (draft from the admin form).
 */
export function buildEmailPreviewHtml(
  key: EmailTemplateKey,
  theme: EmailTheme,
  subject: string,
  bodyMarkdown: string,
): { html: string; previewSubject: string } {
  const t: EmailTheme = {
    ...theme,
    fontFamily: theme.fontFamily || EMAIL_FONT_FAMILY,
  };

  switch (key) {
    case 'welcome': {
      const siteUrl = isSafeHttpUrl(PREVIEW_SAMPLE.siteUrl)
        ? PREVIEW_SAMPLE.siteUrl
        : 'https://provenance.guru';
      const md = interpolateTemplate(
        bodyMarkdown,
        { name: escapeHtml(PREVIEW_SAMPLE.name) },
        { siteUrl },
      );
      const inner = `<div>${renderMarkdownToEmailHtml(md, t)}</div>`;
      return {
        html: buildEmailHtml('Welcome to Provenance', inner, t),
        previewSubject: subject,
      };
    }
    case 'certification': {
      const safeTitle = escapeHtml(PREVIEW_SAMPLE.artworkTitle);
      const safeArtworkUrl = isSafeHttpUrl(PREVIEW_SAMPLE.artworkUrl)
        ? PREVIEW_SAMPLE.artworkUrl
        : 'https://provenance.guru';
      const certBlock = buildCertBlockHtml(t, PREVIEW_SAMPLE.certificateNumber);
      const md = interpolateTemplate(
        bodyMarkdown,
        {
          name: escapeHtml(PREVIEW_SAMPLE.name),
          artworkTitle: safeTitle,
        },
        {
          artworkUrl: safeArtworkUrl,
          CERT_BLOCK: certBlock,
        },
      );
      const inner = `<div>${renderMarkdownToEmailHtml(md, t)}</div>`;
      return {
        html: buildEmailHtml('Your Artwork Has Been Certified', inner, t),
        previewSubject: subject.split('{{artworkTitle}}').join(PREVIEW_SAMPLE.artworkTitle),
      };
    }
    case 'notification': {
      const siteUrl = PREVIEW_SAMPLE.siteUrl;
      const url = isSafeHttpUrl(PREVIEW_SAMPLE.ctaUrl)
        ? PREVIEW_SAMPLE.ctaUrl
        : isSafeHttpUrl(siteUrl)
          ? siteUrl
          : 'https://provenance.guru';
      const md = interpolateTemplate(
        bodyMarkdown,
        {
          name: escapeHtml(PREVIEW_SAMPLE.name),
          title: escapeHtml(PREVIEW_SAMPLE.notificationTitle),
          body: escapeHtml(PREVIEW_SAMPLE.notificationBody)
            .replace(/\r\n/g, '\n')
            .replace(/\n/g, '\n\n'),
          ctaLabel: escapeHtml(PREVIEW_SAMPLE.ctaLabel),
        },
        { ctaUrl: url },
      );
      const inner = `<div>${renderMarkdownToEmailHtml(md, t)}</div>`;
      return {
        html: buildEmailHtml(PREVIEW_SAMPLE.notificationTitle, inner, t),
        previewSubject: subject,
      };
    }
    case 'summary': {
      const siteUrl = isSafeHttpUrl(PREVIEW_SAMPLE.siteUrl)
        ? PREVIEW_SAMPLE.siteUrl
        : 'https://provenance.guru';
      const itemsHtml = buildItemsHtml(t, PREVIEW_SUMMARY_ITEMS);
      const md = interpolateTemplate(
        bodyMarkdown,
        {
          name: escapeHtml(PREVIEW_SAMPLE.name),
          periodLabel: escapeHtml(PREVIEW_SAMPLE.periodLabel),
        },
        {
          siteUrl,
          ITEMS: itemsHtml,
        },
      );
      const inner = `<div>${renderMarkdownToEmailHtml(md, t)}</div>`;
      return {
        html: buildEmailHtml(`Your ${PREVIEW_SAMPLE.periodLabel}`, inner, t),
        previewSubject: subject,
      };
    }
    case 'update': {
      const siteUrl = PREVIEW_SAMPLE.siteUrl;
      const url = isSafeHttpUrl(PREVIEW_SAMPLE.ctaUrl)
        ? PREVIEW_SAMPLE.ctaUrl
        : isSafeHttpUrl(siteUrl)
          ? siteUrl
          : 'https://provenance.guru';
      const md = interpolateTemplate(
        bodyMarkdown,
        {
          name: escapeHtml(PREVIEW_SAMPLE.name),
          title: escapeHtml(PREVIEW_SAMPLE.updateTitle),
          body: escapeHtml(PREVIEW_SAMPLE.updateBody)
            .replace(/\r\n/g, '\n')
            .replace(/\n/g, '\n\n'),
          ctaLabel: escapeHtml(PREVIEW_SAMPLE.updateLinkLabel),
        },
        { ctaUrl: url },
      );
      const inner = `<div>${renderMarkdownToEmailHtml(md, t)}</div>`;
      return {
        html: buildEmailHtml(PREVIEW_SAMPLE.updateTitle, inner, t),
        previewSubject: subject,
      };
    }
  }
}
