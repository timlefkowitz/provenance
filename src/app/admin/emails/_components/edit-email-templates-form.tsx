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
import {
  EMAIL_LAYOUT_PRESET_IDS,
  EMAIL_LAYOUT_PRESET_LABELS,
  EMAIL_THEMES,
  type AdminEmailThemeDraft,
} from '~/lib/email-layout-presets';
import type { EmailLayoutPresetId } from '~/lib/email-layout';

// ── Preset swatch card ─────────────────────────────────────────────────────

function PresetCard({
  id,
  isActive,
  onSelect,
}: {
  id: EmailLayoutPresetId;
  isActive: boolean;
  onSelect: (id: EmailLayoutPresetId) => void;
}) {
  const t = EMAIL_THEMES[id];
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`group relative flex flex-col overflow-hidden rounded-lg border-2 transition-all text-left ${
        isActive
          ? 'border-blue-500 shadow-md ring-2 ring-blue-200'
          : 'border-neutral-200 hover:border-neutral-400'
      }`}
      aria-pressed={isActive}
    >
      {/* Mini email preview */}
      <div
        style={{ backgroundColor: t.parchment }}
        className="h-24 w-full relative overflow-hidden"
      >
        {/* Hero band preview for hero variant */}
        {t.mastheadVariant === 'hero' && t.heroBandColor && (
          <div
            style={{ backgroundColor: t.heroBandColor, height: '36px' }}
            className="w-full flex items-center justify-center"
          >
            <span
              style={{ color: t.heroBandTextColor ?? '#fff', fontFamily: t.fontFamily, fontSize: '8px', letterSpacing: '0.2em' }}
              className="uppercase font-bold"
            >
              {t.mastheadTitle}
            </span>
          </div>
        )}

        {/* Non-hero masthead preview */}
        {t.mastheadVariant !== 'hero' && (
          <div className="px-3 pt-2.5">
            <p
              style={{
                color: t.wine,
                fontFamily: t.mastheadVariant === 'mono' ? 'monospace' : t.fontFamily,
                fontSize: '7px',
                letterSpacing: '0.18em',
                textAlign: t.mastheadAlign === 'center' ? 'center' : 'left',
              }}
              className="uppercase font-bold m-0 leading-none"
            >
              {t.mastheadTitle}
            </p>
            <div
              style={{ backgroundColor: t.mastheadVariant === 'double-rule' ? t.wine : t.cardBorder, height: '1px', marginTop: '5px' }}
            />
          </div>
        )}

        {/* Card preview */}
        {t.useCard ? (
          <div
            style={{
              backgroundColor: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: t.cardRadius,
              margin: '6px 6px 0',
              padding: '5px 6px',
            }}
          >
            {t.accentBarHeight > 0 && (
              <div style={{ backgroundColor: t.wine, height: `${Math.min(t.accentBarHeight, 2)}px`, borderRadius: '2px 2px 0 0', margin: '-5px -6px 4px -6px' }} />
            )}
            <div style={{ backgroundColor: t.ink, height: '3px', width: '55%', borderRadius: '2px' }} />
            <div style={{ backgroundColor: t.inkMuted, height: '2px', width: '80%', borderRadius: '2px', marginTop: '4px' }} />
            <div style={{ backgroundColor: t.inkMuted, height: '2px', width: '70%', borderRadius: '2px', marginTop: '3px' }} />
            {/* Button preview */}
            <div
              style={{
                backgroundColor: t.wine,
                borderRadius: t.buttonRadius,
                marginTop: '6px',
                padding: '3px 8px',
                display: 'inline-block',
              }}
            >
              <span style={{ color: t.accentText, fontSize: '6px', fontFamily: t.fontFamily }}>
                {t.buttonTextTransform === 'uppercase' ? 'ACTION' : 'Action'}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ margin: '6px 6px 0', padding: '5px 6px' }}>
            <div style={{ backgroundColor: t.ink, height: '3px', width: '55%', borderRadius: '2px' }} />
            <div style={{ backgroundColor: t.inkMuted, height: '2px', width: '80%', borderRadius: '2px', marginTop: '4px' }} />
            <div style={{ backgroundColor: t.inkMuted, height: '2px', width: '70%', borderRadius: '2px', marginTop: '3px' }} />
            <div
              style={{
                backgroundColor: t.wine,
                borderRadius: t.buttonRadius,
                marginTop: '6px',
                padding: '3px 8px',
                display: 'inline-block',
              }}
            >
              <span style={{ color: t.accentText, fontSize: '6px', fontFamily: t.fontFamily }}>
                {t.buttonTextTransform === 'uppercase' ? 'ACTION' : 'Action'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Label + swatches */}
      <div className="px-2.5 py-2 bg-white border-t border-neutral-200">
        <p className="text-[11px] font-semibold text-neutral-800 leading-none mb-1.5">
          {EMAIL_LAYOUT_PRESET_LABELS[id]}
        </p>
        <div className="flex items-center gap-1">
          {[t.parchment, t.cardBg, t.wine, t.accentText].map((color, i) => (
            <span
              key={i}
              title={color}
              style={{ backgroundColor: color, border: '1px solid rgba(0,0,0,0.12)' }}
              className="block w-3 h-3 rounded-sm flex-shrink-0"
            />
          ))}
          <span className="text-[9px] text-neutral-400 ml-0.5 leading-none">
            bg · card · accent · label
          </span>
        </div>
      </div>

      {isActive && (
        <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
          Active
        </div>
      )}
    </button>
  );
}

// ── Main form ──────────────────────────────────────────────────────────────

const TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  welcome:            'Welcome',
  certification:      'Certification',
  notification:       'Notification',
  summary:            'Summary',
  update:             'Update',
  artwork_featured:   'Artwork featured',
  institution_thanks: 'Institution thank-you',
};

const PLACEHOLDER_HELP = `Placeholders (use exactly as shown):
• welcome: {{name}}, {{siteUrl}}
• certification: {{name}}, {{artworkTitle}}, {{artworkUrl}}, {{CERT_BLOCK}}
• notification: {{name}}, {{title}}, {{body}}, {{ctaUrl}}, {{ctaLabel}}
• summary: {{name}}, {{periodLabel}}, {{siteUrl}}, {{ITEMS}}
• update: {{name}}, {{title}}, {{body}}, {{ctaUrl}}, {{ctaLabel}}
• artwork_featured: {{artistName}}, {{artworkTitle}}, {{artworkUrl}}
• institution_thanks: {{name}}, {{feedbackUrl}}, {{institutionUrl}}

Primary action links: keep one markdown line like [Your label](https://…) that matches the main URL we inject (e.g. Get Started → site/artworks/add). That line is replaced by a bulletproof button; if you change the URL or label, remove the old markdown line to avoid a duplicate text link.`;

function serializeWorkspaceState(
  theme: AdminEmailThemeDraft,
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
  const [theme, setTheme] = useState<AdminEmailThemeDraft>(initial.theme);
  const [templates, setTemplates] = useState(initial.templates);

  const savedBaselineRef = useRef(serializeWorkspaceState(initial.theme, initial.templates));
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
          template_key:  activeKey,
          subject:       t.subject,
          body_markdown: t.bodyMarkdown,
          theme,
        });
        if (seq !== previewSeq.current) return;
        if (res.ok) {
          setPreviewHtml(res.html);
          setPreviewSubject(res.previewSubject);
        } else {
          toast.error(res.error ?? 'Preview failed');
        }
      } catch (e) {
        if (seq !== previewSeq.current) return;
        console.error('[Admin/emails] preview client error', e);
        toast.error(e instanceof Error ? e.message : 'Preview failed');
      } finally {
        if (seq === previewSeq.current) setPreviewLoading(false);
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
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
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
        toast.success(`Design style saved — ${EMAIL_LAYOUT_PRESET_LABELS[theme.layout_preset]}`);
      } else {
        toast.error(res.error ?? 'Failed to save');
      }
    });
  };

  const saveTemplate = () => {
    const t = templates[activeKey];
    startTransition(async () => {
      const res = await saveEmailTemplate({
        template_key:  activeKey,
        subject:       t.subject,
        body_markdown: t.bodyMarkdown,
      });
      if (res.ok) {
        savedBaselineRef.current = serializeWorkspaceState(theme, templates);
        toast.success(`Saved "${TEMPLATE_LABELS[activeKey]}" template`);
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
        template_key:  activeKey,
        subject:       t.subject,
        body_markdown: t.bodyMarkdown,
        theme,
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

      {/* ── Design style ──────────────────────────────────────── */}
      <section className="border border-neutral-200 rounded-lg p-6 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Design style</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Choose a design for all outgoing transactional emails. The live preview updates instantly.
              Save with <strong>Save style &amp; masthead</strong> to apply globally.
            </p>
          </div>
          <span
            className={`text-xs font-medium uppercase tracking-wide px-2.5 py-1 rounded border ${
              isDirty
                ? 'border-amber-700/50 text-amber-900 bg-amber-50/90'
                : 'border-neutral-200 text-neutral-500 bg-neutral-50'
            }`}
          >
            {isDirty ? 'Unsaved changes' : 'Saved'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {EMAIL_LAYOUT_PRESET_IDS.map((id) => (
            <PresetCard
              key={id}
              id={id}
              isActive={theme.layout_preset === id}
              onSelect={(id) => setTheme((s) => ({ ...s, layout_preset: id }))}
            />
          ))}
        </div>
      </section>

      {/* ── Masthead ──────────────────────────────────────────── */}
      <section className="border border-neutral-200 rounded-lg p-6 bg-white space-y-4">
        <h2 className="text-xl font-semibold text-neutral-900">Masthead</h2>
        <p className="text-sm text-neutral-600">
          Wordmark and subtitle shown at the top of every email.
        </p>
        <div>
          <Label htmlFor="masthead_title">Wordmark</Label>
          <Input
            id="masthead_title"
            className="mt-1"
            value={theme.masthead_title}
            onChange={(e) => setTheme((s) => ({ ...s, masthead_title: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="masthead_subtitle">Subtitle</Label>
          <Input
            id="masthead_subtitle"
            className="mt-1"
            value={theme.masthead_subtitle}
            onChange={(e) => setTheme((s) => ({ ...s, masthead_subtitle: e.target.value }))}
          />
        </div>
        <Button type="button" onClick={saveTheme} disabled={pending}>
          Save style &amp; masthead
        </Button>
      </section>

      {/* ── Templates ─────────────────────────────────────────── */}
      <section className="border border-neutral-200 rounded-lg p-6 bg-white space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Email templates (Markdown)</h2>
          <p className="text-sm text-neutral-600 whitespace-pre-line mt-2">
            {PLACEHOLDER_HELP}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] lg:items-start">
          <div className="space-y-4 min-w-0">
            <div>
              <Label htmlFor="template_key">Template</Label>
              <select
                id="template_key"
                className="mt-1 w-full max-w-md border border-neutral-300 rounded-md bg-white px-3 py-2 text-neutral-900"
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
              <p className="text-xs text-neutral-500 mt-1">
                Notification &amp; summary/update emails still receive the subject from the app when sent
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
              <Button type="button" onClick={saveTemplate} disabled={pending}>
                Save this template
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={refreshPreviewNow}
                disabled={pending || previewLoading}
              >
                {previewLoading ? 'Updating preview…' : 'Refresh preview'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={sendTest}
                disabled={pending || previewLoading}
              >
                Send test to my email
              </Button>
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-neutral-900">Live preview</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border ${
                    isDirty
                      ? 'border-amber-700/40 text-amber-900 bg-amber-50/80'
                      : 'border-neutral-200 text-neutral-500 bg-neutral-50'
                  }`}
                >
                  {isDirty ? 'Draft' : 'Saved'}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                  {EMAIL_LAYOUT_PRESET_LABELS[theme.layout_preset]}
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Placeholders are filled with example names, links, and lists so you can see the real layout.
            </p>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 shadow-sm overflow-hidden">
              <div className="border-b border-neutral-200 bg-white px-4 py-3 space-y-1.5 text-left">
                <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wider">Subject</p>
                <p className="text-sm text-neutral-900 leading-snug line-clamp-3">
                  {previewSubject ?? '—'}
                </p>
              </div>
              <div className="bg-neutral-100 p-2 sm:p-3">
                {previewHtml ? (
                  <iframe
                    title="Email HTML preview"
                    className="w-full min-h-[480px] rounded-md border border-neutral-200 bg-white shadow-inner"
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    srcDoc={previewHtml}
                  />
                ) : (
                  <div className="flex min-h-[280px] items-center justify-center rounded-md border border-dashed border-neutral-300 bg-white px-4 text-center text-sm text-neutral-500">
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
