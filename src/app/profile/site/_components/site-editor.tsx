'use client';

import { useState, useTransition, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, Upload, X, RefreshCw, ChevronDown } from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';
import type {
  TemplateId,
  SiteTheme,
  SiteSections,
  SiteCta,
  SiteArtworkFilters,
  CertificateTypeKey,
} from '~/app/_sites/types';
import {
  SITE_ACCENTS,
  SITE_FONT_PAIRINGS,
  SITE_SURFACES,
  DEFAULT_SECTIONS,
  DEFAULT_THEME,
  DEFAULT_SURFACE,
  DEFAULT_ARTWORK_FILTERS,
  CERTIFICATE_TYPE_LABELS,
} from '~/app/_sites/types';
import type { ManageableProfile } from '../_actions/get-manageable-profiles';
import type { SiteConfig } from '../_actions/get-site-config';
import { upsertSiteAction } from '../_actions/upsert-site';
import { publishSiteAction } from '../_actions/publish-site';
import { validateHandleAction } from '../_actions/validate-handle';
import { uploadSiteImage } from '../_actions/upload-site-image';
import { transferHandleAction } from '../_actions/transfer-handle';
import { deleteSiteAction } from '../_actions/delete-site';

type Template = { id: TemplateId; name: string; description: string; bestFor: string };

const TEMPLATES: Template[] = [
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Magazine-style. Large hero, serif typography.',
    bestFor: 'Galleries & institutions',
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'Minimalist grid. Artwork-first, clean and fast.',
    bestFor: 'Artists',
  },
  {
    id: 'atelier',
    name: 'Atelier',
    description: 'Single-page narrative scroll. Story-driven.',
    bestFor: 'Collectors & curators',
  },
];

const CERT_TYPE_KEYS: CertificateTypeKey[] = ['authenticity', 'ownership', 'show'];

type Props = {
  profileId: string;
  siteDomain: string;
  profile: {
    name: string;
    role: string;
    source: 'own' | 'team';
    team_role?: 'owner' | 'admin' | 'member';
  };
  manageableProfiles: ManageableProfile[];
  initialConfig: SiteConfig | null;
};

export function SiteEditor({
  profileId,
  siteDomain,
  profile,
  manageableProfiles,
  initialConfig,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  console.log('[SiteEditor] mount', {
    profileId,
    profileName: profile.name,
    initialHandle: initialConfig?.handle ?? '(none)',
    initialPublished: initialConfig?.publishedAt ?? null,
    siteDomain,
  });

  const [saving, startSave] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [uploadingHero, startUploadHero] = useTransition();

  // Form state
  const [handle, setHandle] = useState(initialConfig?.handle ?? '');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [handleOk, setHandleOk] = useState(false);
  const [checkingHandle, startHandleCheck] = useTransition();
  const [takenByOwnProfile, setTakenByOwnProfile] = useState<{ profileId: string; profileName: string } | null>(null);
  const [transferring, startTransfer] = useTransition();
  const [deletingConflict, startDeleteConflict] = useTransition();

  const [templateId, setTemplateId] = useState<TemplateId>(initialConfig?.templateId ?? 'studio');
  const [theme, setTheme] = useState<SiteTheme>(initialConfig?.theme ?? DEFAULT_THEME);
  const [sections, setSections] = useState<SiteSections>(initialConfig?.sections ?? DEFAULT_SECTIONS);
  const [cta, setCta] = useState<SiteCta | null>(initialConfig?.cta ?? null);
  const [ctaEnabled, setCtaEnabled] = useState(Boolean(initialConfig?.cta));

  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(initialConfig?.heroImageUrl ?? null);
  const [tagline, setTagline] = useState<string>(initialConfig?.tagline ?? '');
  const [aboutOverride, setAboutOverride] = useState<string>(initialConfig?.aboutOverride ?? '');
  const [surfaceColor, setSurfaceColor] = useState<string>(initialConfig?.surfaceColor ?? DEFAULT_SURFACE);
  const [artworkFilters, setArtworkFilters] = useState<SiteArtworkFilters>(
    initialConfig?.artworkFilters ?? DEFAULT_ARTWORK_FILTERS,
  );

  const [publishedAt, setPublishedAt] = useState(initialConfig?.publishedAt ?? null);
  const [siteUrl, setSiteUrl] = useState(initialConfig?.siteUrl ?? null);

  // Preview iframe state
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPublished = Boolean(publishedAt);
  const previewSrc = useMemo(
    () => `/profile/site/preview?profileId=${profileId}&embed=1&v=${previewKey}`,
    [profileId, previewKey],
  );

  // ── Profile selector ──
  function handleSwitchProfile(newProfileId: string) {
    if (newProfileId === profileId) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('profileId', newProfileId);
    router.push(`/profile/site?${params.toString()}`);
  }

  // ── Save & refresh preview ──
  async function persist(): Promise<{ ok: boolean }> {
    const result = await upsertSiteAction({
      profileId,
      handle,
      templateId,
      theme,
      sections,
      cta: ctaEnabled && cta?.label && cta?.url ? cta : null,
      heroImageUrl,
      tagline,
      aboutOverride,
      surfaceColor,
      artworkFilters,
    });
    if (!result.success) {
      toast.error(result.error);
      return { ok: false };
    }
    setHandle(result.handle);
    return { ok: true };
  }

  function handleSave() {
    startSave(async () => {
      const { ok } = await persist();
      if (!ok) return;
      toast.success('Changes saved.');
      setPreviewKey((k) => k + 1);
    });
  }

  function handleRefreshPreview() {
    setPreviewKey((k) => k + 1);
  }

  function handleHandleBlur() {
    if (!handle.trim()) {
      setHandleError(null);
      setHandleOk(false);
      setTakenByOwnProfile(null);
      return;
    }
    startHandleCheck(async () => {
      const result = await validateHandleAction(handle, profileId);
      if (result.ok) {
        setHandle(result.normalized);
        setHandleError(null);
        setHandleOk(true);
        setTakenByOwnProfile(null);
      } else {
        setHandleError(result.error);
        setHandleOk(false);
        setTakenByOwnProfile(result.takenByOwnProfile ?? null);
      }
    });
  }

  function handleTransferClaim() {
    if (!takenByOwnProfile) return;
    const profileName = takenByOwnProfile.profileName;
    startTransfer(async () => {
      console.log('[SiteEditor] transferClaim', { from: takenByOwnProfile.profileId, to: profileId });
      const result = await transferHandleAction(takenByOwnProfile.profileId, profileId);
      if (!result.success) {
        console.error('[SiteEditor] transferClaim failed', result.error);
        toast.error(result.error);
        return;
      }
      console.log('[SiteEditor] transferClaim success', { handle: result.handle });
      setHandle(result.handle);
      setHandleError(null);
      setHandleOk(true);
      setTakenByOwnProfile(null);
      setPreviewKey((k) => k + 1);
      toast.success(`Site transferred from "${profileName}" to this profile.`);
      // Don't router.refresh() — that resets all client state; preview key bump is enough
    });
  }

  function handleRemoveConflict() {
    if (!takenByOwnProfile) return;
    const profileName = takenByOwnProfile.profileName;
    startDeleteConflict(async () => {
      console.log('[SiteEditor] removeConflict: deleting old row', { from: takenByOwnProfile.profileId });
      const deleteResult = await deleteSiteAction(takenByOwnProfile.profileId);
      if (!deleteResult.success) {
        console.error('[SiteEditor] removeConflict: delete failed', deleteResult.error);
        toast.error(deleteResult.error);
        return;
      }

      // Clear conflict state immediately so handle shows green
      setHandleError(null);
      setHandleOk(true);
      setTakenByOwnProfile(null);

      // Auto-save to create the new profile_sites row for this profile
      console.log('[SiteEditor] removeConflict: auto-saving for new profile', { profileId, handle });
      const saveResult = await upsertSiteAction({
        profileId,
        handle,
        templateId,
        theme,
        sections,
        cta: ctaEnabled && cta?.label && cta?.url ? cta : null,
        heroImageUrl,
        tagline,
        aboutOverride,
        surfaceColor,
        artworkFilters,
      });

      if (!saveResult.success) {
        console.error('[SiteEditor] removeConflict: auto-save failed', saveResult.error);
        toast.error(`Handle freed but save failed: ${saveResult.error}`);
        return;
      }

      console.log('[SiteEditor] removeConflict: success', { handle: saveResult.handle });
      setHandle(saveResult.handle);
      setPreviewKey((k) => k + 1);
      toast.success(`Started fresh on "${saveResult.handle}" — removed from "${profileName}".`);
    });
  }

  // ── Hero upload ──
  function handleHeroFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    startUploadHero(async () => {
      const fd = new FormData();
      fd.append('file', file);
      const result = await uploadSiteImage(profileId, fd);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setHeroImageUrl(result.url);
      toast.success('Banner uploaded. Save to apply to your site.');
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClearHero() {
    setHeroImageUrl(null);
  }

  // ── Cert type filter ──
  function toggleCertType(key: CertificateTypeKey) {
    setArtworkFilters((prev) => {
      const has = prev.certificate_types.includes(key);
      const next = has
        ? prev.certificate_types.filter((k) => k !== key)
        : [...prev.certificate_types, key];
      return {
        ...prev,
        // Always keep at least one; if user tries to clear last, restore default
        certificate_types: next.length > 0 ? next : prev.certificate_types,
      };
    });
  }

  // ── Publish ──
  function handlePublishToggle() {
    startPublish(async () => {
      if (!publishedAt) {
        const { ok } = await persist();
        if (!ok) return;
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
      setPreviewKey((k) => k + 1);
      router.refresh();
    });
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,520px)_1fr] gap-8">

      {/* ─────────────── LEFT: CONTROLS ─────────────── */}
      <div className="space-y-8 min-w-0">

        {/* ── PROFILE SELECTOR ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-2">Powered by which profile</h2>
          <p className="text-xs text-ink/50 font-serif mb-3">
            Your site pulls content from one of your Provenance profiles.
          </p>
          <ProfileSelect
            value={profileId}
            options={manageableProfiles}
            onChange={handleSwitchProfile}
          />
          <p className="mt-2 text-[11px] text-ink/40 font-serif">
            {profile.source === 'own'
              ? `You own this ${profile.role} profile.`
              : `You manage this gallery as ${profile.team_role ?? 'team'}.`}
          </p>
        </section>

        {/* ── HANDLE ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-1">Site address</h2>
          <p className="text-xs text-ink/50 font-serif mb-3">
            Lowercase letters, numbers, and hyphens. Max 63 chars.
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value);
                  setHandleOk(false);
                  setHandleError(null);
                }}
                onBlur={handleHandleBlur}
                placeholder="your-name"
                className={cn(
                  'font-serif pr-32',
                  handleError && 'border-red-400 focus-visible:ring-red-300',
                  handleOk && 'border-green-500 focus-visible:ring-green-200',
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/35 font-serif pointer-events-none">
                .{siteDomain}
              </span>
            </div>
            {checkingHandle && (
              <span className="text-xs text-ink/40 font-serif">Checking…</span>
            )}
            {handleOk && !checkingHandle && (
              <span className="text-xs text-green-600 font-serif">Available</span>
            )}
          </div>
        {handleError && !takenByOwnProfile && (
          <p className="mt-1.5 text-xs text-red-600 font-serif">{handleError}</p>
        )}
        {takenByOwnProfile && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 space-y-2.5">
            <div>
              <p className="text-xs font-medium text-amber-900 font-serif">{handleError}</p>
              <p className="text-[11px] text-amber-700 font-serif mt-0.5">
                Choose how to free up this handle:
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleTransferClaim}
                disabled={transferring || deletingConflict}
                className="text-xs font-semibold font-serif px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {transferring ? 'Transferring…' : 'Transfer site to this profile'}
              </button>
              <button
                type="button"
                onClick={handleRemoveConflict}
                disabled={transferring || deletingConflict}
                className="text-xs font-semibold font-serif px-3 py-1.5 rounded-md border border-amber-400 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
              >
                {deletingConflict ? 'Removing…' : `Remove from "${takenByOwnProfile.profileName}" and start fresh`}
              </button>
            </div>
            <p className="text-[10px] text-amber-600 font-serif">
              Transfer keeps the existing config (theme, hero, published state).
              Remove clears the old site entirely so you can configure from scratch here.
            </p>
          </div>
        )}
        </section>

        {/* ── TAGLINE ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-1">Tagline</h2>
          <p className="text-xs text-ink/50 font-serif mb-3">
            One line under your name. Optional.
          </p>
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Painter & sculptor based in Brooklyn"
            maxLength={140}
            className="font-serif"
          />
        </section>

        {/* ── HERO IMAGE ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-1">Banner image</h2>
          <p className="text-xs text-ink/50 font-serif mb-3">
            Optional hero / background image. Wider is better — try 2400×900px.
          </p>

          {heroImageUrl ? (
            <div className="relative group rounded-lg overflow-hidden border border-wine/15">
              <div className="relative aspect-[3/1] w-full bg-wine/5">
                <Image
                  src={heroImageUrl}
                  alt="Site banner"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <button
                type="button"
                onClick={handleClearHero}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove banner"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingHero}
              className="w-full aspect-[3/1] rounded-lg border-2 border-dashed border-wine/20 hover:border-wine/40 bg-wine/3 hover:bg-wine/5 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50"
            >
              <Upload className="h-5 w-5 text-wine/60" />
              <span className="text-xs text-ink/60 font-serif">
                {uploadingHero ? 'Uploading…' : 'Upload banner image'}
              </span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleHeroFileChange}
          />
        </section>

        {/* ── ABOUT OVERRIDE ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-1">About text</h2>
          <p className="text-xs text-ink/50 font-serif mb-3">
            Optional. Leave blank to use your profile bio.
          </p>
          <textarea
            value={aboutOverride}
            onChange={(e) => setAboutOverride(e.target.value)}
            placeholder="Tell visitors about your practice…"
            maxLength={2000}
            rows={5}
            className="w-full px-3 py-2 text-sm font-serif rounded-md border border-wine/20 focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/20 bg-white/60 resize-y"
          />
        </section>

        {/* ── TEMPLATE ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-3">Template</h2>
          <div className="space-y-2.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  'w-full text-left rounded-lg border px-4 py-3 transition-all',
                  templateId === t.id
                    ? 'border-wine bg-wine/5 shadow-sm'
                    : 'border-wine/15 hover:border-wine/30',
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display font-semibold text-ink text-sm">{t.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-wine/60 font-serif">
                    {t.bestFor}
                  </p>
                </div>
                <p className="text-xs text-ink/60 font-serif leading-relaxed mt-1">
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* ── COLORS ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-3">Colors</h2>

          <div className="space-y-5">
            <div>
              <p className="text-[11px] text-ink/50 font-serif mb-2 uppercase tracking-widest">
                Background
              </p>
              <div className="flex flex-wrap gap-2.5">
                {SITE_SURFACES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSurfaceColor(s.key)}
                    title={s.label}
                    className={cn(
                      'flex flex-col items-center gap-1.5 transition-transform',
                      surfaceColor === s.key && 'scale-105',
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg border-2 transition-all',
                        surfaceColor === s.key ? 'border-ink' : 'border-wine/20',
                      )}
                      style={{ background: s.bg }}
                    />
                    <span className="text-[10px] font-serif text-ink/60">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] text-ink/50 font-serif mb-2 uppercase tracking-widest">
                Accent
              </p>
              <div className="flex flex-wrap gap-2.5">
                {SITE_ACCENTS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setTheme((prev) => ({ ...prev, accent: a.key }))}
                    title={a.label}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      theme.accent === a.key
                        ? 'border-ink scale-110'
                        : 'border-transparent hover:scale-105',
                    )}
                    style={{ background: a.value }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] text-ink/50 font-serif mb-2 uppercase tracking-widest">
                Typography
              </p>
              <div className="flex flex-wrap gap-2">
                {SITE_FONT_PAIRINGS.map((fp) => (
                  <button
                    key={fp.key}
                    type="button"
                    onClick={() => setTheme((prev) => ({ ...prev, font_pairing: fp.key }))}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-xs transition-all font-serif',
                      theme.font_pairing === fp.key
                        ? 'border-wine bg-wine/5 text-ink'
                        : 'border-wine/15 text-ink/60 hover:border-wine/30',
                    )}
                  >
                    <span className="font-semibold block">{fp.label}</span>
                    <span className="text-[10px] text-ink/40">{fp.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CERTIFICATE TYPE FILTER ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-1">
            Which artworks to show
          </h2>
          <p className="text-xs text-ink/50 font-serif mb-3">
            Filter by certificate type. At least one must be selected.
          </p>
          <div className="space-y-2">
            {CERT_TYPE_KEYS.map((key) => {
              const meta = CERTIFICATE_TYPE_LABELS[key];
              const checked = artworkFilters.certificate_types.includes(key);
              return (
                <label
                  key={key}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-3.5 py-2.5 cursor-pointer transition-all',
                    checked
                      ? 'border-wine bg-wine/5'
                      : 'border-wine/15 hover:border-wine/30',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCertType(key)}
                    className="mt-0.5 accent-wine"
                  />
                  <div>
                    <p className="text-xs font-semibold text-ink font-serif">{meta.label}</p>
                    <p className="text-[11px] text-ink/55 font-serif leading-relaxed">
                      {meta.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* ── SECTIONS ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-3">Content sections</h2>
          <div className="space-y-2.5">
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
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-ink font-serif">Call-to-action</h2>
              <p className="text-xs text-ink/50 font-serif">Shop, booking, newsletter…</p>
            </div>
            <Switch checked={ctaEnabled} onCheckedChange={setCtaEnabled} />
          </div>
          {ctaEnabled && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                value={cta?.label ?? ''}
                onChange={(e) => setCta((prev) => ({ url: prev?.url ?? '', ...prev, label: e.target.value }))}
                placeholder="Shop now"
                className="font-serif"
              />
              <Input
                value={cta?.url ?? ''}
                onChange={(e) => setCta((prev) => ({ label: prev?.label ?? '', ...prev, url: e.target.value }))}
                placeholder="https://your-shop.com"
                className="font-serif"
                type="url"
              />
            </div>
          )}
        </section>

      </div>

      {/* ─────────────── RIGHT: LIVE PREVIEW ─────────────── */}
      <div className="lg:sticky lg:top-[140px] self-start">
        <div className="rounded-xl border border-wine/15 bg-white shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[600px]">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-wine/10 bg-parchment/40">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-wine/70 font-serif font-semibold">
                Live preview
              </span>
              {handle && (
                <span className="text-[11px] text-ink/40 font-serif">
                  {handle}.{siteDomain}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRefreshPreview}
                className="p-1.5 rounded hover:bg-wine/10 text-ink/60 hover:text-ink transition-colors"
                title="Refresh preview"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <a
                href={`/profile/site/preview?profileId=${profileId}`}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded hover:bg-wine/10 text-ink/60 hover:text-ink transition-colors"
                title="Open preview in new tab"
              >
                <Eye className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {handle ? (
            <div className="relative flex-1 flex flex-col">
              <iframe
                ref={previewRef}
                key={previewKey}
                src={previewSrc}
                className="flex-1 w-full"
                title="Site preview"
              />
              {/* Overlay nudge: visible only while saving/transferring, shown for a moment */}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-6">
              <div>
                <p className="text-xs text-ink/40 font-serif uppercase tracking-widest mb-2">
                  Preview
                </p>
                <p className="text-sm font-semibold text-ink/70 font-serif mb-1">
                  Set a handle to see your site
                </p>
                <p className="text-xs text-ink/45 font-serif">
                  Type a handle above, then click{' '}
                  <span className="font-semibold text-wine">Save &amp; refresh preview</span>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action bar — under the preview, sticky bottom feel */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5 px-1">
          <Button
            onClick={handleSave}
            disabled={saving || publishing}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          >
            {saving ? 'Saving…' : 'Save & refresh preview'}
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
              className="text-sm text-wine underline underline-offset-2 font-serif hover:text-wine/70 transition-colors ml-auto"
            >
              Visit live site →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Profile selector dropdown
// ────────────────────────────────────────────────────────────

function ProfileSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: ManageableProfile[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);

  // Group: own profiles first, then team galleries
  const ownProfiles = options.filter((o) => o.source === 'own');
  const teamProfiles = options.filter((o) => o.source === 'team');

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-wine/20 bg-white hover:border-wine/40 transition-colors font-serif"
      >
        <div className="flex items-center gap-3 min-w-0">
          {current?.picture_url ? (
            <Image
              src={current.picture_url}
              alt={current.name}
              width={28}
              height={28}
              className="rounded-full object-cover w-7 h-7 shrink-0"
              unoptimized
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-wine/15 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-semibold text-wine">
                {current?.name?.slice(0, 2).toUpperCase() ?? '??'}
              </span>
            </div>
          )}
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium text-ink truncate">{current?.name ?? 'Select profile'}</p>
            <p className="text-[10px] uppercase tracking-widest text-ink/40">
              {current?.role}
              {current?.source === 'team' && ` · team ${current.team_role}`}
            </p>
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-ink/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 left-0 right-0 mt-1.5 max-h-80 overflow-auto rounded-lg border border-wine/15 bg-white shadow-lg">
            {ownProfiles.length > 0 && (
              <ProfileSection title="Your profiles" items={ownProfiles} value={value} onPick={(id) => { onChange(id); setOpen(false); }} />
            )}
            {teamProfiles.length > 0 && (
              <ProfileSection title="Galleries you manage" items={teamProfiles} value={value} onPick={(id) => { onChange(id); setOpen(false); }} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ProfileSection({
  title,
  items,
  value,
  onPick,
}: {
  title: string;
  items: ManageableProfile[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <p className="px-3 pt-3 pb-1.5 text-[10px] uppercase tracking-widest text-ink/40 font-serif font-semibold">
        {title}
      </p>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onPick(it.id)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 hover:bg-wine/5 transition-colors text-left',
            value === it.id && 'bg-wine/5',
          )}
        >
          {it.picture_url ? (
            <Image
              src={it.picture_url}
              alt={it.name}
              width={24}
              height={24}
              className="rounded-full object-cover w-6 h-6 shrink-0"
              unoptimized
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-wine/15 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-semibold text-wine">
                {it.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate font-serif">{it.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif">
              {it.role}
              {it.source === 'team' && ` · team ${it.team_role}`}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
