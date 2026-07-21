'use client';

import { useState, useTransition, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, Upload, X, RefreshCw, ChevronDown, Sparkles, GripVertical, Pencil, ShoppingBag, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  TemplateId,
  SiteTheme,
  SiteSections,
  SiteCta,
  SiteArtworkFilters,
  CertificateTypeKey,
  SiteSectionKey,
} from '~/app/_sites/types';
import {
  SITE_FONT_PAIRINGS,
  SITE_SURFACES,
  DEFAULT_SECTIONS,
  DEFAULT_THEME,
  DEFAULT_SURFACE,
  DEFAULT_ARTWORK_FILTERS,
  CERTIFICATE_TYPE_LABELS,
  ORDERABLE_SECTION_KEYS,
  DEFAULT_SECTION_ORDER,
  SECTION_LABELS,
} from '~/app/_sites/types';
import { TemplatePicker } from './template-picker';
import { CustomDomainCard } from './custom-domain-card';
import { AccentColorPicker } from './accent-color-picker';
import { FeaturedArtworksPicker } from './featured-artworks-picker';
import { FeaturedExhibitionsPicker } from './featured-exhibitions-picker';
import { buildGoogleFontsUrl } from '~/app/_sites/_templates/palette';
import type { ManageableProfile } from '../_actions/get-manageable-profiles';
import type { SiteConfig } from '../_actions/get-site-config';
import { upsertSiteAction } from '../_actions/upsert-site';
import { publishSiteAction } from '../_actions/publish-site';
import { validateHandleAction } from '../_actions/validate-handle';
import { uploadSiteImage } from '../_actions/upload-site-image';
import { transferHandleAction } from '../_actions/transfer-handle';
import { deleteSiteAction } from '../_actions/delete-site';
import { useSitePreviewBridge } from '../_hooks/use-site-preview-bridge';

const CERT_TYPE_KEYS: CertificateTypeKey[] = ['authenticity', 'ownership', 'show'];

type EditorTab = 'branding' | 'design' | 'content' | 'address';

const EDITOR_TABS: { id: EditorTab; label: string }[] = [
  { id: 'branding', label: 'Branding' },
  { id: 'design', label: 'Design' },
  { id: 'content', label: 'Content' },
  { id: 'address', label: 'Address & Domain' },
];

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
  hasActiveSubscription: boolean;
  /** Whether the artist/gallery has a Stripe Connect account on file. */
  sellingConnected: boolean;
  /** Whether that Stripe Connect account has completed onboarding and can accept charges. */
  sellingChargesEnabled: boolean;
};

export function SiteEditor({
  profileId,
  siteDomain,
  profile,
  manageableProfiles,
  initialConfig,
  hasActiveSubscription,
  sellingConnected,
  sellingChargesEnabled,
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
  const [logoImageUrl, setLogoImageUrl] = useState<string | null>(initialConfig?.logoImageUrl ?? null);
  const [uploadingLogo, startUploadLogo] = useTransition();
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState<string>(initialConfig?.displayName ?? '');
  const [tagline, setTagline] = useState<string>(initialConfig?.tagline ?? '');
  const [aboutOverride, setAboutOverride] = useState<string>(initialConfig?.aboutOverride ?? '');
  const [surfaceColor, setSurfaceColor] = useState<string>(initialConfig?.surfaceColor ?? DEFAULT_SURFACE);
  const [artworkFilters, setArtworkFilters] = useState<SiteArtworkFilters>(
    initialConfig?.artworkFilters ?? DEFAULT_ARTWORK_FILTERS,
  );
  const [featuredArtworkIds, setFeaturedArtworkIds] = useState<string[]>(
    initialConfig?.featuredArtworkIds ?? [],
  );
  const [featuredExhibitionIds, setFeaturedExhibitionIds] = useState<string[]>(
    initialConfig?.featuredExhibitionIds ?? [],
  );
  const [artworkClickBehavior, setArtworkClickBehavior] = useState<'page' | 'modal' | 'lightbox'>(
    initialConfig?.artworkClickBehavior ?? 'page',
  );

  const sellingFullyEnabled = hasActiveSubscription && sellingConnected && sellingChargesEnabled;

  const [sectionOrder, setSectionOrder] = useState<SiteSectionKey[]>(
    initialConfig?.sectionOrder ?? DEFAULT_SECTION_ORDER,
  );

  const [publishedAt, setPublishedAt] = useState(initialConfig?.publishedAt ?? null);
  const [siteUrl, setSiteUrl] = useState(initialConfig?.siteUrl ?? null);

  const [activeTab, setActiveTab] = useState<EditorTab>(
    initialConfig?.handle ? 'branding' : 'address',
  );

  // Persistent save status — shown in both the action bar and preview header
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >(initialConfig?.handle ? 'saved' : 'idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit mode: when true the iframe receives edit=1 and the bridge is active
  const [editMode, setEditMode] = useState(false);

  // Preview iframe state
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus + scroll the handle input — works even when Input doesn't forward refs
  function focusHandleInput() {
    console.log('[SiteEditor] focusHandleInput');
    setActiveTab('address');
    const section = document.getElementById('site-address');
    const input = section?.querySelector('input') as HTMLInputElement | null;
    console.log('[SiteEditor] focusHandleInput resolved', { section: !!section, input: !!input });
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Delay focus until scroll animation settles
    setTimeout(() => {
      input?.focus();
    }, 400);
  }

  const isPublished = Boolean(publishedAt);
  const previewSrc = useMemo(() => {
    const params = new URLSearchParams({
      profileId,
      embed: '1',
      v: String(previewKey),
      template: templateId,
      accent: theme.accent,
      surface: surfaceColor,
      font: theme.font_pairing,
    });
    if (theme.text_color) params.set('ink', theme.text_color);
    if (editMode) params.set('edit', '1');
    return `/profile/site/preview?${params.toString()}`;
  }, [profileId, previewKey, templateId, theme.accent, theme.font_pairing, theme.text_color, surfaceColor, editMode]);

  const editorFontsUrl = useMemo(() => {
    const families = [...new Set(SITE_FONT_PAIRINGS.flatMap((fp) => fp.googleFamilies))];
    return buildGoogleFontsUrl(families);
  }, []);

  // ── Preview bridge (postMessage to/from iframe) ──
  const bridgeOverrides = useMemo(() => ({
    displayName,
    tagline,
    bio: aboutOverride,
    sectionOrder,
    sections,
    cta: ctaEnabled && cta?.label && cta?.url ? cta : null,
    heroImageUrl,
    logoImageUrl,
    accentColor: theme.accent,
    surfaceColor,
  }), [displayName, tagline, aboutOverride, sectionOrder, sections, cta, ctaEnabled, heroImageUrl, logoImageUrl, theme.accent, surfaceColor]);

  const triggerImageUpload = useCallback((field: 'hero' | 'logo') => {
    if (field === 'hero') fileInputRef.current?.click();
    else if (field === 'logo') logoFileInputRef.current?.click();
  }, []);

  const bridgeSetters = useMemo(() => ({
    setDisplayName,
    setTagline,
    setAboutOverride,
    setSectionOrder,
    setSections,
    setCta,
    setCtaEnabled,
    setHeroImageUrl,
    setLogoImageUrl,
    markUnsaved,
    triggerImageUpload,
  }), [triggerImageUpload]); // eslint-disable-line react-hooks/exhaustive-deps

  const { resetReady } = useSitePreviewBridge(previewRef, bridgeOverrides, bridgeSetters, editMode);

  // ── Profile selector ──
  function handleSwitchProfile(newProfileId: string) {
    if (newProfileId === profileId) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('profileId', newProfileId);
    router.push(`/profile/site?${params.toString()}`);
  }

  // Pin the active profileId into the URL so refresh / back stays on this profile.
  // Replaces (not pushes) so navigation history isn't polluted by every save.
  function pinProfileIdInUrl() {
    const current = searchParams?.get('profileId');
    if (current === profileId) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('profileId', profileId);
    console.log('[SiteEditor] pinning profileId in URL', { profileId });
    router.replace(`/profile/site?${params.toString()}`, { scroll: false });
  }

  // ── Save & refresh preview ──
  async function persist(): Promise<{ ok: boolean }> {
    console.log('[SiteEditor] persist start', { profileId, handle, templateId });
    setSaveStatus('saving');
    setSaveError(null);
    const result = await upsertSiteAction({
      profileId,
      handle,
      templateId,
      theme,
      sections,
      cta: ctaEnabled && cta?.label && cta?.url ? cta : null,
      heroImageUrl,
      logoImageUrl,
      displayName,
      tagline,
      aboutOverride,
      surfaceColor,
      artworkFilters,
      featuredArtworkIds,
      sectionOrder,
      featuredExhibitionIds,
      artworkClickBehavior,
    });
    if (!result.success) {
      console.error('[SiteEditor] persist failed', result.error, {
        takenByOwnProfile: result.takenByOwnProfile ?? null,
      });

      if (result.takenByOwnProfile) {
        // Surface the conflict banner (Transfer / Remove) instead of a dead-end
        // red strip. The banner is already wired up for blur-triggered validation;
        // we reuse the same state here so Save also triggers it.
        setHandleError(result.error);
        setHandleOk(false);
        setTakenByOwnProfile(result.takenByOwnProfile);
        setSaveStatus('idle');
        setSaveError(null);
        setActiveTab('address');
        // Scroll the conflict into view
        setTimeout(() => {
          document.getElementById('site-address')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        setSaveStatus('error');
        setSaveError(result.error);
        toast.error(`Save failed: ${result.error}`);
      }
      return { ok: false };
    }
    console.log('[SiteEditor] persist success', { handle: result.handle });
    setHandle(result.handle);
    setSaveStatus('saved');
    setSaveError(null);
    pinProfileIdInUrl();
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

  // Mark form dirty when user changes anything
  function markUnsaved() {
    if (saveStatus === 'saved') setSaveStatus('idle');
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
      pinProfileIdInUrl();
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
        logoImageUrl,
        displayName,
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
      pinProfileIdInUrl();
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

  // ── Logo upload ──
  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    startUploadLogo(async () => {
      const fd = new FormData();
      fd.append('file', file);
      const result = await uploadSiteImage(profileId, fd);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setLogoImageUrl(result.url);
      markUnsaved();
      toast.success('Logo uploaded. Save to apply to your site.');
    });
    if (logoFileInputRef.current) logoFileInputRef.current.value = '';
  }

  function handleClearLogo() {
    setLogoImageUrl(null);
    markUnsaved();
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
      pinProfileIdInUrl();
    });
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,520px)_1fr] gap-8">
      {editorFontsUrl && (
        <link rel="stylesheet" href={editorFontsUrl} />
      )}

      {/* ─────────────── LEFT: CONTROLS ─────────────── */}
      <div className="space-y-6 min-w-0">

        {!hasActiveSubscription && (
          <div className="rounded-xl border border-wine/20 bg-gradient-to-br from-wine via-[#5c3a30] to-amber-900/80 p-5 text-parchment shadow-md">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-amber-200 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold font-serif mb-1">
                  Upgrade for a professional site
                </h2>
                <p className="text-xs text-parchment/80 font-serif leading-relaxed mb-4">
                  Free sites include a Provenance navbar and &ldquo;Powered by Provenance&rdquo;
                  footer. Upgrade to remove branding and connect your own domain.
                </p>
                <ul className="text-[11px] text-parchment/75 font-serif space-y-1 mb-4 list-disc list-inside">
                  <li>Remove the Provenance navbar from your site</li>
                  <li>Connect a custom domain (yourname.com)</li>
                  <li>Full white-label experience</li>
                </ul>
                <Button
                  asChild
                  size="sm"
                  className="bg-parchment text-wine hover:bg-parchment/90 font-serif font-semibold"
                >
                  <Link href="/subscription">Upgrade now</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

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

        {/* ── TAB NAV ── */}
        <nav
          className="flex flex-wrap gap-1 border-b border-wine/15 pb-0"
          aria-label="Site settings sections"
        >
          {EDITOR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative px-3 py-2 text-xs font-serif font-medium transition-colors rounded-t-md',
                activeTab === tab.id
                  ? 'text-ink bg-white border border-b-white border-wine/15 -mb-px z-10'
                  : 'text-ink/50 hover:text-ink/80',
              )}
            >
              {tab.label}
              {tab.id === 'address' && !handle && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-wine"
                  aria-label="Required"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="space-y-8 pt-2">
          {/* ── BRANDING TAB ── */}
          {activeTab === 'branding' && (
            <>
        {/* ── LOGO IMAGE ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-1">Logo image</h2>
          <p className="text-xs text-ink/50 font-serif mb-3">
            Optional. Replaces the text name in your site&apos;s hero and header. PNG with transparent background works best.
          </p>

          {logoImageUrl ? (
            <div className="relative group rounded-lg overflow-hidden border border-wine/15 bg-white/60">
              <div className="relative h-20 w-full flex items-center justify-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoImageUrl}
                  alt="Site logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <button
                type="button"
                onClick={handleClearLogo}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove logo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => logoFileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="w-full h-20 rounded-lg border-2 border-dashed border-wine/20 hover:border-wine/40 bg-wine/3 hover:bg-wine/5 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50"
            >
              <Upload className="h-5 w-5 text-wine/60" />
              <span className="text-xs text-ink/60 font-serif">
                {uploadingLogo ? 'Uploading…' : 'Upload logo image'}
              </span>
            </button>
          )}
          <input
            ref={logoFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoFileChange}
          />
        </section>

        {/* ── DISPLAY NAME ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-1">Site display name</h2>
          <p className="text-xs text-ink/50 font-serif mb-3">
            The name shown in your site&apos;s header and logo. Leave blank to use your profile name.
          </p>
          <Input
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); markUnsaved(); }}
            placeholder={profile.name}
            maxLength={80}
            className="font-serif"
          />
          {displayName.trim() && displayName.trim() !== profile.name && (
            <p className="mt-1.5 text-[11px] text-ink/50 font-serif">
              Showing <span className="font-medium text-ink">&ldquo;{displayName.trim()}&rdquo;</span> instead of &ldquo;{profile.name}&rdquo;
            </p>
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
            </>
          )}

          {/* ── DESIGN TAB ── */}
          {activeTab === 'design' && (
            <>
        {/* ── TEMPLATE ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-3">Template</h2>
          <TemplatePicker
            selectedId={templateId}
            onSelect={(id) => {
              setTemplateId(id);
              markUnsaved();
            }}
          />
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
                    onClick={() => { setSurfaceColor(s.key); markUnsaved(); }}
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
              <AccentColorPicker
                value={theme.accent}
                onChange={(accent) => {
                  setTheme((prev) => ({ ...prev, accent }));
                  markUnsaved();
                }}
              />
            </div>

            <div>
              <p className="text-[11px] text-ink/50 font-serif mb-2 uppercase tracking-widest">
                Text color
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTheme((prev) => ({ ...prev, text_color: null }));
                    markUnsaved();
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 transition-transform',
                    !theme.text_color && 'scale-105',
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all',
                      !theme.text_color ? 'border-ink' : 'border-wine/20',
                    )}
                    style={{ background: 'linear-gradient(135deg, #111 50%, #f5f5f5 50%)' }}
                  />
                  <span className="text-[10px] font-serif text-ink/60">Auto</span>
                </button>
                <AccentColorPicker
                  value={theme.text_color ?? '#111111'}
                  onChange={(color) => {
                    setTheme((prev) => ({ ...prev, text_color: color }));
                    markUnsaved();
                  }}
                />
              </div>
              {theme.text_color && (
                <button
                  type="button"
                  className="mt-2 text-[11px] font-serif text-wine/70 hover:text-wine underline"
                  onClick={() => { setTheme((prev) => ({ ...prev, text_color: null })); markUnsaved(); }}
                >
                  Reset to surface default
                </button>
              )}
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
                    onClick={() => {
                      setTheme((prev) => ({ ...prev, font_pairing: fp.key }));
                      markUnsaved();
                    }}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-xs transition-all text-left min-w-[8.5rem]',
                      theme.font_pairing === fp.key
                        ? 'border-wine bg-wine/5 text-ink'
                        : 'border-wine/15 text-ink/60 hover:border-wine/30',
                    )}
                    style={{
                      fontFamily: fp.body
                        ? `"${fp.body}", system-ui, sans-serif`
                        : undefined,
                    }}
                  >
                    <span
                      className="font-semibold block"
                      style={{
                        fontFamily: fp.heading
                          ? `"${fp.heading}", Georgia, serif`
                          : undefined,
                      }}
                    >
                      {fp.label}
                    </span>
                    <span className="text-[10px] text-ink/40">{fp.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
            </>
          )}

          {/* ── CONTENT TAB ── */}
          {activeTab === 'content' && (
            <>
        {/* ── SELL YOUR WORK ── */}
        <section className="rounded-xl border border-wine/15 bg-white/60 p-4">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-wine/60" />
              <h2 className="text-sm font-semibold text-ink font-serif">Sell your work</h2>
            </div>
            {sellingFullyEnabled ? (
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-serif font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                <CheckCircle2 className="h-3 w-3" /> Enabled
              </span>
            ) : hasActiveSubscription && sellingConnected ? (
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-serif font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                <AlertCircle className="h-3 w-3" /> Incomplete
              </span>
            ) : null}
          </div>
          <p className="text-xs text-ink/50 font-serif mb-3">
            {!hasActiveSubscription
              ? 'Accept payments for your artworks directly on your creator site — upgrade to unlock Stripe checkout.'
              : sellingFullyEnabled
                ? 'Payments are connected. Add a price to any work from your artworks list to start selling it here.'
                : sellingConnected
                  ? 'Your Stripe account is connected, but onboarding is incomplete. Finish setup to start accepting payments.'
                  : 'Connect a Stripe account to accept payments for artworks — buyers pay directly through checkout on your site.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {!hasActiveSubscription ? (
              <Button asChild size="sm" className="bg-wine text-parchment hover:bg-wine/90 font-serif">
                <Link href="/subscription">Upgrade to sell</Link>
              </Button>
            ) : sellingFullyEnabled ? (
              <Button asChild size="sm" variant="outline" className="font-serif border-wine/30">
                <Link href="/artworks">Mark works for sale →</Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="bg-wine text-parchment hover:bg-wine/90 font-serif">
                <Link href="/settings#selling">
                  {sellingConnected ? 'Finish Stripe setup' : 'Set up payments'}
                </Link>
              </Button>
            )}
          </div>
        </section>

        {/* ── ARTWORK CLICK BEHAVIOR ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-1">When visitors click a work</h2>
          <p className="text-xs text-ink/50 font-serif mb-3">
            Choose what happens when someone taps an artwork thumbnail on your site.
          </p>
          <div className="space-y-2">
            {([
              { id: 'page', label: 'Open detail page', desc: 'Navigate to a full artwork page — includes all details, inquire, and buy.' },
              { id: 'modal', label: 'Quick-view popup', desc: 'Show a card overlay with image, price, and CTAs — visitor stays on your site.' },
              { id: 'lightbox', label: 'Lightbox gallery', desc: 'Full-screen gallery with prev / next navigation and a details panel.' },
            ] as const).map(({ id, label, desc }) => (
              <label
                key={id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3.5 py-2.5 cursor-pointer transition-all',
                  artworkClickBehavior === id
                    ? 'border-wine bg-wine/5'
                    : 'border-wine/15 hover:border-wine/30',
                )}
              >
                <input
                  type="radio"
                  name="artwork-click-behavior"
                  value={id}
                  checked={artworkClickBehavior === id}
                  onChange={() => { setArtworkClickBehavior(id); markUnsaved(); }}
                  className="mt-0.5 accent-wine"
                />
                <div>
                  <p className="text-xs font-semibold text-ink font-serif">{label}</p>
                  <p className="text-[11px] text-ink/55 font-serif leading-relaxed">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* ── FEATURED ARTWORKS ── */}
        <section>
          <h2 className="text-sm font-semibold text-ink font-serif mb-1">Featured works</h2>
          <p className="text-xs text-ink/50 font-serif mb-3">
            Choose specific works to showcase on your site and set their display order.
          </p>
          <FeaturedArtworksPicker
            profileId={profileId}
            selectedIds={featuredArtworkIds}
            onChange={(ids) => { setFeaturedArtworkIds(ids); markUnsaved(); }}
          />
        </section>

        {/* ── FEATURED EXHIBITIONS (gallery only) ── */}
        {profile.role === 'gallery' && (
          <section>
            <h2 className="text-sm font-semibold text-ink font-serif mb-1">Featured exhibitions</h2>
            <p className="text-xs text-ink/50 font-serif mb-3">
              Choose specific exhibitions to highlight on your site and set their display order.
            </p>
            <FeaturedExhibitionsPicker
              profileId={profileId}
              selectedIds={featuredExhibitionIds}
              onChange={(ids) => { setFeaturedExhibitionIds(ids); markUnsaved(); }}
            />
          </section>
        )}

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
          <h2 className="text-sm font-semibold text-ink font-serif mb-1">Content sections</h2>
          <p className="text-xs text-ink/50 font-serif mb-3">Drag to reorder. Toggle to show or hide.</p>
          <SortableSectionList
            order={sectionOrder}
            sections={sections}
            onOrderChange={(newOrder) => { setSectionOrder(newOrder); markUnsaved(); }}
            onVisibilityChange={(key, visible) => {
              setSections((prev) => ({ ...prev, [key]: visible }));
              markUnsaved();
            }}
          />
          {/* cv section (not orderable) */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-wine/10">
            <Label className="font-serif capitalize text-sm text-ink/80">CV</Label>
            <Switch
              checked={sections.cv}
              onCheckedChange={(v) => { setSections((prev) => ({ ...prev, cv: v })); markUnsaved(); }}
            />
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
            </>
          )}

          {/* ── ADDRESS & DOMAIN TAB ── */}
          {activeTab === 'address' && (
            <>
        {/* ── HANDLE ── */}
        <section
          id="site-address"
          className={cn(
            'rounded-xl transition-all',
            !handle && 'border-2 border-wine/30 bg-wine/5 p-4 -mx-1',
          )}
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="text-sm font-semibold text-ink font-serif">Site address</h2>
            {!handle && (
              <span className="text-[10px] uppercase tracking-widest font-serif font-bold text-wine bg-wine/15 px-2 py-0.5 rounded-full">
                Required
              </span>
            )}
          </div>
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
                  markUnsaved();
                }}
                onBlur={handleHandleBlur}
                placeholder="your-name"
                autoComplete="off"
                className={cn(
                  'font-serif pr-32 bg-white',
                  handleError && 'border-red-400 focus-visible:ring-red-300',
                  handleOk && 'border-green-500 focus-visible:ring-green-200',
                  !handle && 'border-wine/40 focus-visible:ring-wine/30',
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

        <CustomDomainCard
          profileId={profileId}
          hasActiveSubscription={hasActiveSubscription}
          customDomain={initialConfig?.customDomain ?? null}
          customDomainVerifiedAt={initialConfig?.customDomainVerifiedAt ?? null}
        />
            </>
          )}
        </div>

      </div>

      {/* ─────────────── RIGHT: LIVE PREVIEW ─────────────── */}
      <div className="lg:sticky lg:top-[140px] self-start">
        <div className="rounded-xl border border-wine/15 bg-white shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[600px]">

          {/* ── Save status strip ── */}
          {saveStatus === 'error' && saveError && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200">
              <span className="text-[10px] uppercase tracking-widest font-serif font-bold text-red-600">Save failed</span>
              <span className="text-xs text-red-700 font-serif flex-1 truncate">{saveError}</span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="shrink-0 text-[11px] font-semibold font-serif px-2.5 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200">
              <span className="text-[11px] font-serif text-amber-700 animate-pulse">Saving…</span>
            </div>
          )}
          {saveStatus === 'idle' && handle && (
            <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200">
              <span className="text-[11px] font-serif text-amber-700">Unsaved changes</span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="text-[11px] font-semibold font-serif px-2.5 py-1 rounded bg-wine text-parchment hover:bg-wine/90 transition-colors"
              >
                Save now
              </button>
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-green-50 border-b border-green-100">
              <span className="text-[11px] font-serif text-green-700">✓ Saved</span>
              {handle && <span className="text-[11px] text-green-600/70 font-serif">{handle}.{siteDomain}</span>}
            </div>
          )}

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
            <div className="flex items-center gap-2">
              {/* Edit mode toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = !editMode;
                  setEditMode(next);
                  if (next) {
                    // Remount iframe so it loads with edit=1
                    setPreviewKey((k) => k + 1);
                  } else {
                    setPreviewKey((k) => k + 1);
                  }
                }}
                title={editMode ? 'Exit edit mode' : 'Enter edit mode'}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-serif font-semibold transition-colors',
                  editMode
                    ? 'bg-wine text-parchment hover:bg-wine/90'
                    : 'bg-wine/10 text-wine hover:bg-wine/20',
                )}
              >
                <Pencil className="h-3 w-3" />
                {editMode ? 'Editing' : 'Edit'}
              </button>
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
                onLoad={() => {
                  // When iframe reloads, reset the ready flag so we re-flush state
                  if (editMode) resetReady();
                }}
              />
              {/* Overlay nudge: visible only while saving/transferring, shown for a moment */}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-6 bg-parchment/30">
              <div className="max-w-xs">
                <p className="text-xs text-ink/40 font-serif uppercase tracking-widest mb-3">
                  Preview
                </p>
                <p className="text-base font-semibold text-ink font-serif mb-2">
                  Choose a site address
                </p>
                <p className="text-xs text-ink/55 font-serif mb-5 leading-relaxed">
                  Pick a handle (e.g. <span className="font-mono text-wine">flight</span>),
                  then save to see your site here.
                </p>
                <button
                  type="button"
                  onClick={focusHandleInput}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-wine text-parchment text-xs font-semibold font-serif hover:bg-wine/90 transition-colors"
                >
                  Choose a handle
                  <span aria-hidden>→</span>
                </button>
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

// ────────────────────────────────────────────────────────────
// Sortable section list (content tab)
// ────────────────────────────────────────────────────────────

function SortableSectionList({
  order,
  sections,
  onOrderChange,
  onVisibilityChange,
}: {
  order: SiteSectionKey[];
  sections: SiteSections;
  onOrderChange: (order: SiteSectionKey[]) => void;
  onVisibilityChange: (key: SiteSectionKey, visible: boolean) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as SiteSectionKey);
    const newIndex = order.indexOf(over.id as SiteSectionKey);
    onOrderChange(arrayMove(order, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {order.map((key) => (
            <SortableSectionRow
              key={key}
              sectionKey={key}
              visible={sections[key] ?? true}
              onVisibilityChange={(v) => onVisibilityChange(key, v)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableSectionRow({
  sectionKey,
  visible,
  onVisibilityChange,
}: {
  sectionKey: SiteSectionKey;
  visible: boolean;
  onVisibilityChange: (v: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sectionKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
        isDragging ? 'border-wine/40 bg-wine/5 shadow-sm' : 'border-wine/15 bg-white/50 hover:border-wine/30',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-0.5 text-ink/30 hover:text-ink/60 cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Label className="flex-1 font-serif text-sm text-ink/80 cursor-default">
        {SECTION_LABELS[sectionKey]}
      </Label>
      <Switch
        checked={visible}
        onCheckedChange={onVisibilityChange}
      />
    </div>
  );
}
