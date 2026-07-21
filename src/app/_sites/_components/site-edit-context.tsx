'use client';

/**
 * SiteEditContext
 *
 * Lives inside the preview iframe. When edit=1, this provider:
 *  - Holds a live override of SiteData fields in client state
 *  - Listens for postMessage from the parent editor window (same-origin)
 *  - Posts change events back up so the editor can sync its own state
 *
 * Templates read from this context via `useSiteEdit()`.
 * When edit mode is off (public site), context values are null/false and all
 * client components degrade to pure-render.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { SiteData, SiteSectionKey } from '../types';

// ── Message types ────────────────────────────────────────────────────────────

export type EditorToPreviewMessage =
  | { type: 'SITE_STATE'; payload: SiteEditOverrides }
  | { type: 'FOCUS_SECTION'; payload: { key: SiteSectionKey } }
  | { type: 'IMAGE_UPLOADED'; payload: { field: 'hero' | 'logo'; url: string } };

export type PreviewToEditorMessage =
  | { type: 'EDIT_TEXT'; payload: { field: EditableTextField; value: string } }
  | { type: 'EDIT_SECTION_ORDER'; payload: { order: SiteSectionKey[] } }
  | { type: 'EDIT_SECTION_VISIBILITY'; payload: { key: SiteSectionKey; visible: boolean } }
  | { type: 'REQUEST_IMAGE_UPLOAD'; payload: { field: 'hero' | 'logo' } }
  | { type: 'EDIT_CTA'; payload: { label: string; url: string } }
  | { type: 'READY' };

export type EditableTextField = 'display_name' | 'tagline' | 'bio';

/** Subset of SiteData fields that can be overridden live via the bridge. */
export type SiteEditOverrides = {
  display_name?: string | null;
  tagline?: string | null;
  bio?: string | null;
  section_order?: SiteSectionKey[] | null;
  sections?: Partial<SiteData['sections']>;
  cta?: SiteData['cta'];
  hero_image_url?: string | null;
  logo_image_url?: string | null;
  accent?: string;
  surface_color?: string | null;
  font_pairing?: string;
  text_color?: string | null;
};

// ── Context shape ────────────────────────────────────────────────────────────

type SiteEditContextValue = {
  isEditMode: boolean;
  overrides: SiteEditOverrides;
  postUp: (msg: PreviewToEditorMessage) => void;
};

const SiteEditContext = createContext<SiteEditContextValue>({
  isEditMode: false,
  overrides: {},
  postUp: () => {},
});

export function useSiteEdit() {
  return useContext(SiteEditContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function SiteEditProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<SiteEditOverrides>({});

  const postUp = useCallback((msg: PreviewToEditorMessage) => {
    if (typeof window === 'undefined' || !window.parent || window.parent === window) return;
    console.log('[SiteEdit] postUp', msg.type);
    window.parent.postMessage({ __provenanceSiteEdit: true, ...msg }, window.location.origin);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as EditorToPreviewMessage & { __provenanceSiteEdit?: boolean };
      if (!data?.__provenanceSiteEdit) return;

      console.log('[SiteEdit] received', data.type);

      if (data.type === 'SITE_STATE') {
        setOverrides((prev) => ({ ...prev, ...data.payload }));
      } else if (data.type === 'IMAGE_UPLOADED') {
        setOverrides((prev) => ({
          ...prev,
          ...(data.payload.field === 'hero'
            ? { hero_image_url: data.payload.url }
            : { logo_image_url: data.payload.url }),
        }));
      }
    }

    window.addEventListener('message', onMessage);

    // Signal ready so the editor can send initial state
    postUp({ type: 'READY' });

    return () => window.removeEventListener('message', onMessage);
  }, [postUp]);

  return (
    <SiteEditContext.Provider value={{ isEditMode: true, overrides, postUp }}>
      {children}
    </SiteEditContext.Provider>
  );
}

/**
 * Merge overrides from the edit context into a SiteData object.
 * Call this at the top of each template in edit mode.
 */
export function applySiteEditOverrides(site: SiteData, overrides: SiteEditOverrides): SiteData {
  return {
    ...site,
    display_name: overrides.display_name !== undefined ? overrides.display_name : site.display_name,
    tagline: overrides.tagline !== undefined ? overrides.tagline : site.tagline,
    bio: overrides.bio !== undefined ? overrides.bio : site.bio,
    section_order: overrides.section_order !== undefined ? overrides.section_order : site.section_order,
    sections: overrides.sections ? { ...site.sections, ...overrides.sections } : site.sections,
    cta: overrides.cta !== undefined ? overrides.cta : site.cta,
    hero_image_url: overrides.hero_image_url !== undefined ? overrides.hero_image_url : site.hero_image_url,
    logo_image_url: overrides.logo_image_url !== undefined ? overrides.logo_image_url : site.logo_image_url,
    theme: {
      ...site.theme,
      ...(overrides.accent ? { accent: overrides.accent } : {}),
      ...(overrides.font_pairing ? { font_pairing: overrides.font_pairing } : {}),
      ...(overrides.text_color !== undefined ? { text_color: overrides.text_color } : {}),
    },
    surface_color: overrides.surface_color !== undefined ? overrides.surface_color : site.surface_color,
  };
}
