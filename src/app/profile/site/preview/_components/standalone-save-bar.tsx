'use client';

/**
 * StandaloneSaveBar
 *
 * Floating toolbar rendered inside the preview page when in standalone edit mode
 * (edit=1, not inside an editor iframe). Provides:
 *  - Save button that calls upsertSiteAction with accumulated overrides
 *  - Hidden file inputs for hero/logo image uploads (triggered by EditableImage)
 *  - Save status feedback
 */

import { useRef, useState, useTransition, useEffect } from 'react';
import { Check, Save, Loader2 } from 'lucide-react';
import { useSiteEdit } from '~/app/_sites/_components/site-edit-context';
import { upsertSiteAction } from '~/app/profile/site/_actions/upsert-site';
import { uploadSiteImage } from '~/app/profile/site/_actions/upload-site-image';
import type { SiteData } from '~/app/_sites/types';
import { ORDERABLE_SECTION_KEYS } from '~/app/_sites/types';

export function StandaloneSaveBar({
  profileId,
  initialData,
}: {
  profileId: string;
  initialData: SiteData;
}) {
  const { overrides, applyOverride, registerImageUploadHandler } = useSiteEdit();
  const [saving, startSave] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const heroInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Register image upload handler so EditableImage can trigger file inputs
  useEffect(() => {
    registerImageUploadHandler((field) => {
      if (field === 'hero') heroInputRef.current?.click();
      else if (field === 'logo') logoInputRef.current?.click();
    });
  }, [registerImageUploadHandler]);

  function handleImageFile(field: 'hero' | 'logo', file: File | null) {
    if (!file) return;
    startUpload(async () => {
      console.log('[SiteEdit] standalone image upload start', { field, name: file.name });
      const form = new FormData();
      form.append('file', file);
      const result = await uploadSiteImage(profileId, form);
      if (!result.success) {
        console.error('[SiteEdit] standalone image upload failed', result.error);
        return;
      }
      console.log('[SiteEdit] standalone image upload complete', { field, url: result.url });
      if (field === 'hero') applyOverride({ hero_image_url: result.url });
      else applyOverride({ logo_image_url: result.url });
    });
  }

  function handleSave() {
    startSave(async () => {
      console.log('[SiteEdit] standalone save start', { profileId });
      setSaveStatus('idle');
      setSaveError(null);

      // Merge overrides onto initialData to build the full save payload
      const handle = initialData.handle;
      const result = await upsertSiteAction({
        profileId,
        handle,
        templateId: initialData.template_id,
        theme: {
          ...initialData.theme,
          ...(overrides.accent ? { accent: overrides.accent } : {}),
          ...(overrides.font_pairing ? { font_pairing: overrides.font_pairing } : {}),
          ...(overrides.text_color !== undefined ? { text_color: overrides.text_color ?? undefined } : {}),
        },
        sections: overrides.sections
          ? { ...initialData.sections, ...overrides.sections }
          : initialData.sections,
        cta: overrides.cta !== undefined ? overrides.cta : initialData.cta,
        heroImageUrl: overrides.hero_image_url !== undefined ? overrides.hero_image_url : initialData.hero_image_url,
        logoImageUrl: overrides.logo_image_url !== undefined ? overrides.logo_image_url : initialData.logo_image_url,
        displayName: overrides.display_name !== undefined ? overrides.display_name : initialData.display_name,
        tagline: overrides.tagline !== undefined ? overrides.tagline : initialData.tagline,
        aboutOverride: overrides.bio !== undefined ? overrides.bio : null,
        surfaceColor: overrides.surface_color !== undefined ? overrides.surface_color : initialData.surface_color,
        sectionOrder: overrides.section_order !== undefined
          ? overrides.section_order
          : (initialData.section_order ?? undefined),
      });

      if (!result.success) {
        console.error('[SiteEdit] standalone save failed', result.error);
        setSaveStatus('error');
        setSaveError(result.error);
        return;
      }

      console.log('[SiteEdit] standalone save complete');
      setSaveStatus('saved');
      // Auto-clear "saved" after 3s
      setTimeout(() => setSaveStatus('idle'), 3000);
    });
  }

  const hasChanges = Object.keys(overrides).length > 0;
  const isBusy = saving || uploading;

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={heroInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleImageFile('hero', e.target.files?.[0] ?? null)}
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleImageFile('logo', e.target.files?.[0] ?? null)}
      />

      {/* Floating save bar — pinned below the preview top bar (top: 40px) */}
      <div
        className="fixed inset-x-0 z-[9998] flex items-center justify-between gap-3 px-4 py-2 shadow-sm"
        style={{
          top: '40px',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p className="text-xs text-gray-500">
          {hasChanges
            ? 'Unsaved changes — click Save to apply.'
            : saveStatus === 'saved'
              ? '✓ All changes saved.'
              : 'Click any text, image, or section to edit.'}
        </p>

        <div className="flex items-center gap-2">
          {saveStatus === 'error' && saveError && (
            <span className="text-xs text-red-600">{saveError}</span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isBusy || (!hasChanges && saveStatus !== 'error')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-opacity disabled:opacity-40"
            style={{
              background: saveStatus === 'saved' ? '#16a34a' : '#4A2F25',
              color: '#fff',
            }}
          >
            {isBusy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check size={12} />
            ) : (
              <Save size={12} />
            )}
            {isBusy ? (uploading ? 'Uploading…' : 'Saving…') : saveStatus === 'saved' ? 'Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Spacer so the save bar doesn't overlap content */}
      <div style={{ height: '40px' }} />
    </>
  );
}
