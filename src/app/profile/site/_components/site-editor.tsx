'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@kit/ui/sonner';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';
import type { TemplateId, SiteTheme, SiteSections, SiteCta } from '~/app/_sites/types';
import { SITE_ACCENTS, SITE_FONT_PAIRINGS, DEFAULT_SECTIONS, DEFAULT_THEME } from '~/app/_sites/types';
import { upsertSiteAction } from '../_actions/upsert-site';
import { publishSiteAction } from '../_actions/publish-site';
import { validateHandleAction } from '../_actions/validate-handle';

type Template = {
  id: TemplateId;
  name: string;
  description: string;
  bestFor: string;
};

const TEMPLATES: Template[] = [
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Magazine-style. Large hero, serif typography, exhibitions-forward.',
    bestFor: 'Galleries & institutions',
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'Minimalist grid. Dense artwork-first layout, clean and fast.',
    bestFor: 'Artists',
  },
  {
    id: 'atelier',
    name: 'Atelier',
    description: 'Single-page narrative scroll. Generous whitespace, story-driven.',
    bestFor: 'Collectors & curators',
  },
];

type Props = {
  profileId: string;
  initialConfig: {
    handle: string;
    templateId: TemplateId;
    theme: SiteTheme;
    sections: SiteSections;
    cta: SiteCta | null;
    publishedAt: string | null;
    siteUrl: string | null;
  } | null;
};

export function SiteEditor({ profileId, initialConfig }: Props) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [publishing, startPublish] = useTransition();

  const [handle, setHandle] = useState(initialConfig?.handle ?? '');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [handleOk, setHandleOk] = useState(false);
  const [checkingHandle, startHandleCheck] = useTransition();

  const [templateId, setTemplateId] = useState<TemplateId>(initialConfig?.templateId ?? 'studio');
  const [theme, setTheme] = useState<SiteTheme>(initialConfig?.theme ?? DEFAULT_THEME);
  const [sections, setSections] = useState<SiteSections>(initialConfig?.sections ?? DEFAULT_SECTIONS);
  const [cta, setCta] = useState<SiteCta | null>(initialConfig?.cta ?? null);
  const [ctaEnabled, setCtaEnabled] = useState(Boolean(initialConfig?.cta));

  const [publishedAt, setPublishedAt] = useState(initialConfig?.publishedAt ?? null);
  const [siteUrl, setSiteUrl] = useState(initialConfig?.siteUrl ?? null);

  const handleRef = useRef<HTMLInputElement>(null);

  const isPublished = Boolean(publishedAt);

  function handleHandleBlur() {
    if (!handle.trim()) {
      setHandleError(null);
      setHandleOk(false);
      return;
    }
    startHandleCheck(async () => {
      const result = await validateHandleAction(handle, profileId);
      if (result.ok) {
        setHandle(result.normalized);
        setHandleError(null);
        setHandleOk(true);
      } else {
        setHandleError(result.error);
        setHandleOk(false);
      }
    });
  }

  function handleSave() {
    startSave(async () => {
      const result = await upsertSiteAction({
        profileId,
        handle,
        templateId,
        theme,
        sections,
        cta: ctaEnabled && cta?.label && cta?.url ? cta : null,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setHandle(result.handle);
      toast.success('Site saved.');
      router.refresh();
    });
  }

  function handlePublishToggle() {
    startPublish(async () => {
      // Save first to ensure latest config is persisted
      if (!publishedAt) {
        const saveResult = await upsertSiteAction({
          profileId,
          handle,
          templateId,
          theme,
          sections,
          cta: ctaEnabled && cta?.label && cta?.url ? cta : null,
        });
        if (!saveResult.success) {
          toast.error(saveResult.error);
          return;
        }
        setHandle(saveResult.handle);
      }

      const result = await publishSiteAction(profileId, !isPublished);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (!isPublished) {
        setPublishedAt(new Date().toISOString());
        setSiteUrl(result.url);
        toast.success('Your site is live!');
      } else {
        setPublishedAt(null);
        setSiteUrl(null);
        toast.success('Site unpublished.');
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-10">

      {/* ── STATUS BANNER ── */}
      {isPublished && siteUrl && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-wine/20 bg-wine/5 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-ink font-serif">Your site is live</p>
            <a
              href={siteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-wine underline underline-offset-2 font-serif"
            >
              {siteUrl.replace('https://', '')}
            </a>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="font-serif border-wine/30 hover:bg-wine/10 shrink-0"
            onClick={handlePublishToggle}
            disabled={publishing}
          >
            {publishing ? 'Unpublishing…' : 'Unpublish'}
          </Button>
        </div>
      )}

      {/* ── HANDLE ── */}
      <section>
        <h2 className="text-sm font-semibold text-ink font-serif mb-1">Your site address</h2>
        <p className="text-xs text-ink/50 font-serif mb-4">
          Lowercase letters, numbers and hyphens. Max 63 characters.
        </p>
        <div className="flex items-center gap-2 max-w-sm">
          <div className="relative flex-1">
            <Input
              ref={handleRef}
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setHandleOk(false);
                setHandleError(null);
              }}
              onBlur={handleHandleBlur}
              placeholder="your-name"
              className={cn(
                'font-serif pr-20',
                handleError && 'border-red-400 focus-visible:ring-red-300',
                handleOk && 'border-green-500 focus-visible:ring-green-200',
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/35 font-serif pointer-events-none">
              .provenance.app
            </span>
          </div>
          {checkingHandle && (
            <span className="text-xs text-ink/40 font-serif">Checking…</span>
          )}
          {handleOk && !checkingHandle && (
            <span className="text-xs text-green-600 font-serif">Available</span>
          )}
        </div>
        {handleError && (
          <p className="mt-1.5 text-xs text-red-600 font-serif">{handleError}</p>
        )}
      </section>

      {/* ── TEMPLATE ── */}
      <section>
        <h2 className="text-sm font-semibold text-ink font-serif mb-4">Template</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={cn(
                'text-left rounded-xl border p-5 transition-all',
                templateId === t.id
                  ? 'border-wine bg-wine/5 shadow-sm'
                  : 'border-wine/15 hover:border-wine/30 hover:bg-wine/3',
              )}
            >
              <p className="font-display font-semibold text-ink text-sm mb-1">{t.name}</p>
              <p className="text-xs text-ink/60 font-serif leading-relaxed mb-2">{t.description}</p>
              <p className="text-[10px] uppercase tracking-widest text-wine/60 font-serif">
                Best for: {t.bestFor}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* ── THEME ── */}
      <section>
        <h2 className="text-sm font-semibold text-ink font-serif mb-4">Theme</h2>

        <div className="space-y-5">
          {/* Accent */}
          <div>
            <p className="text-xs text-ink/50 font-serif mb-3 uppercase tracking-widest">
              Accent color
            </p>
            <div className="flex flex-wrap gap-3">
              {SITE_ACCENTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setTheme((prev) => ({ ...prev, accent: a.key }))}
                  title={a.label}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    theme.accent === a.key ? 'border-ink scale-110' : 'border-transparent hover:scale-105',
                  )}
                  style={{ background: a.value }}
                />
              ))}
            </div>
          </div>

          {/* Font pairing */}
          <div>
            <p className="text-xs text-ink/50 font-serif mb-3 uppercase tracking-widest">
              Typography
            </p>
            <div className="flex gap-3">
              {SITE_FONT_PAIRINGS.map((fp) => (
                <button
                  key={fp.key}
                  type="button"
                  onClick={() => setTheme((prev) => ({ ...prev, font_pairing: fp.key }))}
                  className={cn(
                    'px-4 py-2.5 rounded-lg border text-sm transition-all font-serif',
                    theme.font_pairing === fp.key
                      ? 'border-wine bg-wine/5 text-ink'
                      : 'border-wine/15 text-ink/60 hover:border-wine/30',
                  )}
                >
                  <span className="font-semibold block text-xs">{fp.label}</span>
                  <span className="text-[10px] text-ink/40">{fp.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTIONS ── */}
      <section>
        <h2 className="text-sm font-semibold text-ink font-serif mb-4">Content sections</h2>
        <div className="space-y-3 max-w-sm">
          {(Object.keys(sections) as (keyof SiteSections)[]).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="font-serif capitalize text-sm text-ink/80">{key}</Label>
              <Switch
                checked={sections[key]}
                onCheckedChange={(v) => setSections((prev) => ({ ...prev, [key]: v }))}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-ink font-serif">Call-to-action button</h2>
            <p className="text-xs text-ink/50 font-serif">
              Link to your shop, booking page, or newsletter.
            </p>
          </div>
          <Switch
            checked={ctaEnabled}
            onCheckedChange={setCtaEnabled}
          />
        </div>

        {ctaEnabled && (
          <div className="grid sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <Label className="font-serif text-xs text-ink/60 mb-1.5 block">Button label</Label>
              <Input
                value={cta?.label ?? ''}
                onChange={(e) => setCta((prev) => ({ url: prev?.url ?? '', ...prev, label: e.target.value }))}
                placeholder="Shop now"
                className="font-serif"
              />
            </div>
            <div>
              <Label className="font-serif text-xs text-ink/60 mb-1.5 block">URL</Label>
              <Input
                value={cta?.url ?? ''}
                onChange={(e) => setCta((prev) => ({ label: prev?.label ?? '', ...prev, url: e.target.value }))}
                placeholder="https://your-shop.com"
                className="font-serif"
                type="url"
              />
            </div>
          </div>
        )}
      </section>

      {/* ── CUSTOM DOMAIN (v1.5) ── */}
      <section className="rounded-xl border border-wine/10 bg-wine/3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink font-serif mb-1">Custom domain</h2>
            <p className="text-xs text-ink/50 font-serif leading-relaxed">
              Use your own domain (e.g.{' '}
              <span className="text-ink/70">myartist.com</span>) instead of a Provenance subdomain.
              Coming soon as a subscription add-on.
            </p>
          </div>
          <span className="shrink-0 text-[10px] uppercase tracking-widest bg-wine/10 text-wine/70 font-serif px-2 py-1 rounded-full">
            v1.5
          </span>
        </div>
      </section>

      {/* ── ACTIONS ── */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-wine/10">
        <Button
          onClick={handleSave}
          disabled={saving || publishing}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>

        <Button
          variant="outline"
          onClick={handlePublishToggle}
          disabled={saving || publishing || !handle.trim()}
          className={cn(
            'font-serif',
            isPublished
              ? 'border-wine/30 hover:bg-wine/10'
              : 'border-wine bg-wine/5 hover:bg-wine/10 text-wine',
          )}
        >
          {publishing
            ? isPublished ? 'Unpublishing…' : 'Publishing…'
            : isPublished ? 'Unpublish' : 'Publish site'}
        </Button>

        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-wine underline underline-offset-2 font-serif hover:text-wine/70 transition-colors"
          >
            Visit site →
          </a>
        )}
      </div>
    </div>
  );
}
