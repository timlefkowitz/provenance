'use client';

import { useEffect } from 'react';

import { getScanVisitorId } from '~/lib/scan-visitor';

import { recordCertificateView } from '../../_actions/record-certificate-view';

/** Counts a view of this certificate page once it has loaded in a real browser. */
export function CertificateViewRecorder({ artworkId }: { artworkId: string }) {
  useEffect(() => {
    void recordCertificateView(artworkId, getScanVisitorId()).catch((err) => {
      console.error('[CertificateView] record failed', err);
    });
  }, [artworkId]);

  return null;
}
