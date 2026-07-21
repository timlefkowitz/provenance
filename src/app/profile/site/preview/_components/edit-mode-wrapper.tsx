'use client';

/**
 * EditModeWrapper
 *
 * Client wrapper rendered by the preview page when edit=1.
 * Mounts SiteEditProvider and re-renders the template with live overrides.
 *
 * Two modes:
 *  - Iframe (embed=1): bridge overrides come in via postMessage from parent editor
 *  - Standalone (edit=1, no embed): overrides accumulate in local state;
 *    StandaloneSaveBar renders a floating toolbar to save changes.
 */

import { useSiteEdit, SiteEditProvider, applySiteEditOverrides } from '~/app/_sites/_components/site-edit-context';
import { renderSiteTemplate } from '~/app/_sites/_templates/render-template';
import { SiteDesignSync } from '~/app/_sites/_components/site-design-sync';
import { StandaloneSaveBar } from './standalone-save-bar';
import type { SiteData } from '~/app/_sites/types';
import type { ReactNode } from 'react';

function EditModeInner({
  initialData,
  chrome,
  profileId,
}: {
  initialData: SiteData;
  chrome: ReactNode;
  profileId?: string;
}) {
  const { overrides, isStandalone } = useSiteEdit();
  const liveData = applySiteEditOverrides(initialData, overrides);

  return (
    <>
      <SiteDesignSync />
      {chrome}
      {isStandalone && profileId && (
        <StandaloneSaveBar profileId={profileId} initialData={initialData} />
      )}
      {renderSiteTemplate(liveData)}
    </>
  );
}

export function EditModeWrapper({
  initialData,
  chrome,
  profileId,
}: {
  initialData: SiteData;
  chrome: ReactNode;
  profileId?: string;
}) {
  return (
    <SiteEditProvider>
      <EditModeInner initialData={initialData} chrome={chrome} profileId={profileId} />
    </SiteEditProvider>
  );
}
