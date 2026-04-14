'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import {
  previewEmailTemplate,
  saveEmailTemplate,
  saveEmailTheme,
  sendTestEmailTemplate,
  type EmailTemplatesAdminPayload,
} from '../_actions/email-templates-admin';
import type { EmailTemplateKey } from '~/lib/email-defaults';

const TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  welcome: 'Welcome',
  certification: 'Certification',
  notification: 'Notification',
  summary: 'Summary',
  update: 'Update',
};

const PLACEHOLDER_HELP = `Placeholders (use exactly as shown):
• welcome: {{name}}, {{siteUrl}}
• certification: {{name}}, {{artworkTitle}}, {{artworkUrl}}, {{CERT_BLOCK}}
• notification: {{name}}, {{title}}, {{body}}, {{ctaUrl}}, {{ctaLabel}}
• summary: {{name}}, {{periodLabel}}, {{siteUrl}}, {{ITEMS}}
• update: {{name}}, {{title}}, {{body}}, {{ctaUrl}}, {{ctaLabel}}

Primary action links: keep one markdown line like [Your label](https://…) that matches the main URL we inject (e.g. Get Started → site/artworks/add). That line is replaced by a bulletproof button; if you change the URL or label, remove the old markdown line to avoid a duplicate text link.`;

function serializeWorkspaceState(
  theme: {
    parchment: string;
    ink: string;
    wine: string;
    ink_subtitle: string;
    ink_muted: string;
    masthead_title: string;
    masthead_subtitle: string;
  },
  templates: EmailTemplatesAdminPayload['templates'],
) {
  return JSON.stringify({ theme, templates });
}

export function EditEmailTemplatesForm({ initial }: { initial: EmailTemplatesAdminPayload }) {
  const [pending, startTransition] = useTransition();
  const keys = useMemo(
    () => Object.keys(initial.templates) as EmailTemplateKey[],
    [initial.templates],
  );
  const [activeKey, setActiveKey] = useState<EmailTemplateKey>(keys[0] ?? 'welcome');

  const [theme, setTheme] = useState({
    parchment: initial.theme.parchment,
    ink: initial.theme.ink,
    wine: initial.theme.wine,
    ink_subtitle: initial.theme.inkSubtitle,
    ink_muted: initial.theme.inkMuted,
    masthead_title: initial.theme.mastheadTitle,
    masthead_subtitle: initial.theme.mastheadSubtitle,
  });

  const [templates, setTemplates] = useState(initial.templates);

  const savedBaselineRef = useRef(
    serializeWorkspaceState(
      {
        parchment: initial.theme.parchment,
        ink: initial.theme.ink,
        wine: initial.theme.wine,
        ink_subtitle: initial.theme.inkSubtitle,
        ink_muted: initial.theme.inkMuted,
        masthead_title: initial.theme.mastheadTitle,
        masthead_subtitle: initial.theme.mastheadSubtitle,
      },
      initial.templates,
    ),
  );

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewSeq = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = serializeWorkspaceState(theme, templates) !== savedBaselineRef.current;

  const runPreview = useCallback(
    async (showEmptyToast: boolean) => {
      const t = templates[activeKey];
      if (!t?.bodyMarkdown?.trim()) {
        if (showEmptyToast) {
          toast.error('Add some body Markdown before previewing.');
        }
        return;
      }

      const seq = ++previewSeq.current;
      setPreviewLoading(true);
      setPreviewHtml(null);
      setPreviewSubject(null);

      try {
        const res = await previewEmailTemplate({
          template_key: activeKey,
          subject: t.subject,
          body_markdown: t.bodyMarkdown,
          theme: {
            parchment: theme.parchment,
            ink: theme.ink,
            wine: theme.wine,
            ink_subtitle: theme.ink_subtitle,
            ink_muted: theme.ink_muted,
            masthead_title: theme.masthead_title,
            masthead_subtitle: theme.masthead_subtitle,
          },
        });
        if (seq !== previewSeq.current) {
          return;
        }
        if (res.ok) {
          setPreviewHtml(res.html);
          setPreviewSubject(res.previewSubject);
        } else {
          toast.error(res.error ?? 'Preview failed');
        }
      } catch (e) {
        if (seq !== previewSeq.current) {
          return;
        }
        console.error('[Admin/emails] preview client error', e);
        toast.error(e instanceof Error ? e.message : 'Preview failed');
      } finally {
        if (seq === previewSeq.current) {
          setPreviewLoading(false);
        }
      }
    },
    [activeKey, templates, theme],
  );

  useEffect(() => {
    const t = templates[activeKey];
    if (!t?.bodyMarkdown?.trim()) {
      previewSeq.current += 1;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      setPreviewHtml(null);
      setPreviewSubject(null);
      setPreviewLoading(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void runPreview(false);
    }, 700);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [runPreview, activeKey, templates, theme]);

  const refreshPreviewNow = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    void runPreview(true);
  };

  const saveTheme = () => {
    startTransition(async () => {
      const res = await saveEmailTheme(theme);
      if (res.ok) {
        savedBaselineRef.current = serializeWorkspaceState(theme, templates);
        toast.success('Email theme saved');
      } else {
        toast.error(res.error ?? 'Failed to save theme');
      }
    });
  };

  const saveTemplate = () => {
    const t = templates[activeKey];
    startTransition(async () => {
      const res = await saveEmailTemplate({
        template_key: activeKey,
        subject: t.subject,
        body_markdown: t.bodyMarkdown,
      });
      if (res.ok) {
        savedBaselineRef.current = serializeWorkspaceState(theme, templates);
        toast.success(`Saved “${TEMPLATE_LABELS[activeKey]}” template`);
      } else {
        toast.error(res.error ?? 'Failed to save template');
      }
    });
  };

  const sendTest = () => {
    const t = templates[activeKey];
    if (!t?.bodyMarkdown?.trim()) {
      toast.error('Add some body Markdown before sending a test.');
      return;
    }
    startTransition(async () => {
      const res = await sendTestEmailTemplate({
        template_key: activeKey,
        subject: t.subject,
        body_markdown: t.bodyMarkdown,
        theme: {
          parchment: theme.parchment,
          ink: theme.ink,
          wine: theme.wine,
          ink_subtitle: theme.ink_subtitle,
          ink_muted: theme.ink_muted,
          masthead_title: theme.masthead_title,
          masthead_subtitle: theme.masthead_subtitle,
        },
      });
      if (res.ok) {
        toast.success('Test email sent — check your inbox.');
      } else {
        toast.error(res.error ?? 'Failed to send test email');
      }
    });
  };

  return (
    <div className="space-y-10">
      <section className="border-4 border-double border-wine p-6 bg-parchment space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-wine">Global theme & masthead</h2>
          <span
            className={`text-xs font-medium uppercase tracking-wide px-2.5 py-1 rounded border ${
              isDirty
                ? 'border-amber-700/50 text-amber-900 bg-amber-50/90'
                : 'border-wine/25 text-ink/50 bg-parchment'
            }`}
          >
            {isDirty ? 'Unsaved changes' : 'Saved'}
          </span>
        </div>
        <p className="text-sm text-ink/70 font-serif">
          Background and text colors apply to all transactional emails. Masthead appears at the top of every email.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['parchment', 'Page background'],
              ['ink', 'Body text'],
              ['wine', 'Headings & buttons'],
              ['ink_subtitle', 'Masthead subtitle'],
              ['ink_muted', 'Footer / muted text'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label htmlFor={key}>{label}</Label>
              <div className="mt-1 flex gap-2 items-center">
                <Input
                  id={key}
                  type="color"
                  className="h-10 w-14 p-1 cursor-pointer"
                  value={theme[key]}
                  onChange={(e) => setTheme((s) => ({ ...s, [key]: e.target.value }))}
                />
                <Input
                  value={theme[key]}
                  onChange={(e) => setTheme((s) => ({ ...s, [key]: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          ))}
        </div>
        <div>
          <Label htmlFor="masthead_title">Masthead title</Label>
          <Input
            id="masthead_title"
            className="mt-1"
            value={theme.masthead_title}
            onChange={(e) => setTheme((s) => ({ ...s, masthead_title: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="masthead_subtitle">Masthead subtitle</Label>
          <Input
            id="masthead_subtitle"
            className="mt-1"
            value={theme.masthead_subtitle}
            onChange={(e) => setTheme((s) => ({ ...s, masthead_subtitle: e.target.value }))}
          />
        </div>
        <Button
          type="button"
          onClick={saveTheme}
          disabled={pending}
          className="bg-wine text-parchment hover:bg-wine/90"
        >
          Save theme
        </Button>
      </section>

      <section className="border-4 border-double border-wine p-6 bg-parchment space-y-6">
        <div>
          <h2 className="font-display text-2xl text-wine">Email templates (Markdown)</h2>
          <p className="text-sm text-ink/70 font-serif whitespace-pre-line mt-2">
            {PLACEHOLDER_HELP}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] lg:items-start">
          <div className="space-y-4 min-w-0">
            <div>
              <Label htmlFor="template_key">Template</Label>
              <select
                id="template_key"
                className="mt-1 w-full max-w-md border border-wine/40 rounded-md bg-parchment px-3 py-2 text-ink"
                value={activeKey}
                onChange={(e) => setActiveKey(e.target.value as EmailTemplateKey)}
              >
                {keys.map((k) => (
                  <option key={k} value={k}>
                    {TEMPLATE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="subject">Subject line</Label>
              <Input
                id="subject"
                className="mt-1"
                value={templates[activeKey].subject}
                onChange={(e) =>
                  setTemplates((s) => ({
                    ...s,
                    [activeKey]: { ...s[activeKey], subject: e.target.value },
                  }))
                }
              />
              <p className="text-xs text-ink/60 mt-1">
                Notification & summary/update emails still receive the subject from the app when sent
                programmatically; this subject is used for welcome/certification and as a default where
                applicable.
              </p>
            </div>
            <div>
              <Label htmlFor="body_md">Body (Markdown)</Label>
              <Textarea
                id="body_md"
                className="mt-1 min-h-[320px] font-mono text-sm"
                value={templates[activeKey].bodyMarkdown}
                onChange={(e) =>
                  setTemplates((s) => ({
                    ...s,
                    [activeKey]: { ...s[activeKey], bodyMarkdown: e.target.value },
                  }))
                }
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={saveTemplate}
                disabled={pending}
                className="bg-wine text-parchment hover:bg-wine/90"
              >
                Save this template
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-wine text-wine"
                onClick={refreshPreviewNow}
                disabled={pending || previewLoading}
              >
                {previewLoading ? 'Updating preview…' : 'Refresh preview'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-wine text-wine"
                onClick={sendTest}
                disabled={pending || previewLoading}
              >
                Send test to my email
              </Button>
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg text-wine">Live preview</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border ${
                    isDirty
                      ? 'border-amber-700/40 text-amber-900 bg-amber-50/80'
                      : 'border-wine/20 text-ink/45 bg-parchment'
                  }`}
                >
                  {isDirty ? 'Draft' : 'Saved'}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-ink/50 font-serif">Sample data</span>
              </div>
            </div>
            <p className="text-xs text-ink/60 font-serif leading-relaxed">
              Placeholders are filled with example names, links, and lists so you can see the real layout.
              Client apps may still override some subject lines when sending.
            </p>
            <div className="rounded-lg border border-wine/25 bg-white/60 shadow-sm overflow-hidden ring-1 ring-black/[0.04]">
              <div className="border-b border-wine/15 bg-[#faf8f4] px-4 py-3 space-y-1.5 text-left">
                <p className="text-[11px] text-ink/45 font-medium uppercase tracking-wider">Subject</p>
                <p className="text-sm text-ink font-serif leading-snug line-clamp-3">
                  {previewSubject ?? '—'}
                </p>
              </div>
              <div className="bg-[#e8e4dc] p-2 sm:p-3">
                {previewHtml ? (
                  <iframe
                    title="Email HTML preview"
                    className="w-full min-h-[480px] rounded-md border border-wine/20 bg-parchment shadow-inner"
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    srcDoc={previewHtml}
                  />
                ) : (
                  <div className="flex min-h-[280px] items-center justify-center rounded-md border border-dashed border-wine/30 bg-parchment/80 px-4 text-center text-sm text-ink/55 font-serif">
                    {previewLoading ? 'Loading preview…' : 'Add Markdown to see preview.'}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
