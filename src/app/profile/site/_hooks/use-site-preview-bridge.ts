'use client';

/**
 * useSitePreviewBridge
 *
 * Runs in the parent editor page. Manages two-way communication with the
 * preview iframe via same-origin postMessage.
 *
 * - Sends the current editor state down to the iframe as SiteEditOverrides
 *   whenever any tracked field changes.
 * - Receives change events from the iframe and calls the provided setter callbacks
 *   so the editor state stays in sync without a DB save.
 */

import { useEffect, useRef, useCallback } from 'react';
import type {
  EditorToPreviewMessage,
  PreviewToEditorMessage,
  SiteEditOverrides,
} from '~/app/_sites/_components/site-edit-context';
import type { SiteSectionKey, SiteData } from '~/app/_sites/types';

export type BridgeSetters = {
  setDisplayName: (v: string) => void;
  setTagline: (v: string) => void;
  setAboutOverride: (v: string) => void;
  setSectionOrder: (order: SiteSectionKey[]) => void;
  setSections: (updater: (prev: SiteData['sections']) => SiteData['sections']) => void;
  setCta: (cta: SiteData['cta']) => void;
  setCtaEnabled: (v: boolean) => void;
  setHeroImageUrl: (url: string | null) => void;
  setLogoImageUrl: (url: string | null) => void;
  markUnsaved: () => void;
  triggerImageUpload: (field: 'hero' | 'logo') => void;
};

export function useSitePreviewBridge(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  overrides: SiteEditOverrides,
  setters: BridgeSetters,
  editMode: boolean,
) {
  const pendingRef = useRef<SiteEditOverrides | null>(null);
  const iframeReadyRef = useRef(false);

  const sendToIframe = useCallback(
    (msg: EditorToPreviewMessage) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      console.log('[SiteEdit] sendToIframe', msg.type);
      (msg as EditorToPreviewMessage & { __provenanceSiteEdit: boolean }).__provenanceSiteEdit = true;
      iframe.contentWindow.postMessage(msg, window.location.origin);
    },
    [iframeRef],
  );

  // Flush pending overrides once iframe is ready
  const flushPending = useCallback(() => {
    if (pendingRef.current && editMode) {
      sendToIframe({ type: 'SITE_STATE', payload: pendingRef.current });
      pendingRef.current = null;
    }
  }, [sendToIframe, editMode]);

  // Listen for messages from iframe
  useEffect(() => {
    if (!editMode) return;

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as PreviewToEditorMessage & { __provenanceSiteEdit?: boolean };
      if (!data?.__provenanceSiteEdit) return;

      console.log('[SiteEdit] received from iframe', data.type);

      if (data.type === 'READY') {
        iframeReadyRef.current = true;
        flushPending();
      } else if (data.type === 'EDIT_TEXT') {
        const { field, value } = data.payload;
        if (field === 'display_name') { setters.setDisplayName(value); setters.markUnsaved(); }
        if (field === 'tagline') { setters.setTagline(value); setters.markUnsaved(); }
        if (field === 'bio') { setters.setAboutOverride(value); setters.markUnsaved(); }
      } else if (data.type === 'EDIT_SECTION_ORDER') {
        setters.setSectionOrder(data.payload.order);
        setters.markUnsaved();
      } else if (data.type === 'EDIT_SECTION_VISIBILITY') {
        setters.setSections((prev) => ({ ...prev, [data.payload.key]: data.payload.visible }));
        setters.markUnsaved();
      } else if (data.type === 'EDIT_CTA') {
        setters.setCta({ label: data.payload.label, url: data.payload.url });
        setters.setCtaEnabled(true);
        setters.markUnsaved();
      } else if (data.type === 'REQUEST_IMAGE_UPLOAD') {
        setters.triggerImageUpload(data.payload.field);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [editMode, setters, flushPending]);

  // Send state down whenever overrides change
  useEffect(() => {
    if (!editMode) return;
    if (!iframeReadyRef.current) {
      pendingRef.current = overrides;
      return;
    }
    sendToIframe({ type: 'SITE_STATE', payload: overrides });
  }, [editMode, overrides, sendToIframe]);

  // Reset ready flag when iframe remounts (previewKey changes trigger key on iframe)
  const resetReady = useCallback(() => {
    iframeReadyRef.current = false;
    pendingRef.current = overrides;
  }, [overrides]);

  return { sendToIframe, resetReady };
}
