'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';

import { openPrintWindow } from '~/app/artworks/edit-provenance/_components/print-menu';

import { BROCHURE } from '../_content';
import { buildBrochureHtml } from '../_helpers/brochure-print-html';

const noopSubscribe = () => () => {};

export function BrochureStudio() {
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => '',
  );
  const [qrSvg, setQrSvg] = useState('');
  // The QR code is rendered off-screen once and its SVG markup reused in the print HTML.
  const qrRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setQrSvg(el.innerHTML);
  }, []);

  const ready = Boolean(origin && qrSvg);
  const preview = ready ? buildBrochureHtml(BROCHURE, { origin, qrSvg }, 'preview') : '';

  const print = () => {
    if (!ready) return;
    openPrintWindow(buildBrochureHtml(BROCHURE, { origin, qrSvg }, 'print'), 1100, 860);
  };

  return (
    <div className="space-y-4">
      <div ref={qrRef} className="hidden" aria-hidden>
        <QRCodeSVG value={BROCHURE.back.qrUrl} size={256} marginSize={0} bgColor="#ffffff" fgColor="#1c1814" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={print}
          disabled={!ready}
          className="inline-flex items-center gap-2 rounded-sm border border-[#1793d1]/40 bg-[#1793d1]/15 px-3 py-1.5 font-mono text-[13px] text-[#67d4ff] hover:bg-[#1793d1]/25 disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          print booklet
        </button>
        <span className="font-mono text-[12px] text-slate-500">
          Preview shows the pages in reading order. Printing imposes them as 8|1, 2|7, 6|3, 4|5.
        </span>
      </div>

      {preview ? (
        <iframe
          title="Brochure preview"
          srcDoc={preview}
          className="h-[80vh] w-full rounded-sm border border-[#1793d1]/20 bg-[#8a8a8a]"
        />
      ) : null}
    </div>
  );
}
