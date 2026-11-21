'use client';

import { useEffect } from 'react';

import { getScanVisitorId } from '~/lib/scan-visitor';

import { recordExhibitionView } from '../_actions/record-exhibition-view';

/** Counts a view of this exhibition page once it has loaded in a real browser. */
export function ExhibitionViewRecorder({ exhibitionId }: { exhibitionId: string }) {
  useEffect(() => {
    void recordExhibitionView(exhibitionId, getScanVisitorId()).catch((err) => {
      console.error('[ExhibitionView] record failed', err);
    });
  }, [exhibitionId]);

  return null;
}
