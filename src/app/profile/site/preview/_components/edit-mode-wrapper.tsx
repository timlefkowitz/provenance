'use client';

/**
 * EditModeWrapper
 *
 * Thin client wrapper rendered by the preview page when edit=1.
 * Mounts SiteEditProvider and re-renders the template with live overrides
 * received from the parent editor window.
 */

import { useSiteEdit, SiteEditProvider, applySiteEditOverrides } from '~/app/_sites/_components/site-edit-context';
import { renderSiteTemplate } from '~/app/_sites/_templates/render-template';
import { SiteDesignSync } from '~/app/_sites/_components/site-design-sync';
import type { SiteData } from '~/app/_sites/types';
import type { ReactNode } from 'react';

function EditModeInner({
  initialData,
  chrome,
}: {
  initialData: SiteData;
  chrome: ReactNode;
}) {
  const { overrides } = useSiteEdit();
  const liveData = applySiteEditOverrides(initialData, overrides);

  return (
    <>
      <SiteDesignSync />
      {chrome}
      {renderSiteTemplate(liveData)}
    </>
  );
}

export function EditModeWrapper({
  initialData,
  chrome,
}: {
  initialData: SiteData;
  chrome: ReactNode;
}) {
  return (
    <SiteEditProvider>
      <EditModeInner initialData={initialData} chrome={chrome} />
    </SiteEditProvider>
  );
}
