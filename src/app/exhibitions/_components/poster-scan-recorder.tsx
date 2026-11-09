'use client';

import { useEffect } from 'react';

import { getScanVisitorId } from '~/lib/scan-visitor';

import { recordPosterScan } from '../_actions/record-poster-scan';

/** The show's own QR code opens the page with this query param. */
export const POSTER_SCAN_PARAM = 'scan';
export const POSTER_SCAN_VALUE = 'poster';

/**
 * Counts a scan when the page was opened from the show's QR code, then drops
 * the param from the address so a refresh or a shared link isn't counted.
 */
export function PosterScanRecorder({ exhibitionId }: { exhibitionId: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(POSTER_SCAN_PARAM) !== POSTER_SCAN_VALUE) return;
    url.searchParams.delete(POSTER_SCAN_PARAM);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    void recordPosterScan(exhibitionId, getScanVisitorId()).catch((err) => {
      console.error('[PosterScan] record failed', err);
    });
  }, [exhibitionId]);

  return null;
}
