'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Info, ImageIcon } from 'lucide-react';

import type { BreakdownRow } from '~/lib/portal-graphs/load-breakdown-rows';
import type { ValueSource } from '~/lib/portal-graphs/value-waterfall';

const SOURCE_LABEL: Record<ValueSource, string> = {
  formal_valuation: 'Formal valuation',
  sale_price: 'Sale price',
  declared_value: 'Declared value',
  unknown: 'No value',
};

const SOURCE_STYLES: Record<ValueSource, string> = {
  formal_valuation: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  sale_price: 'bg-blue-50 text-blue-800 border-blue-200',
  declared_value: 'bg-amber-50 text-amber-800 border-amber-200',
  unknown: 'bg-ink/5 text-ink/50 border-ink/10',
};

const CERT_LABELS: Record<string, string> = {
  authenticity: 'COA',
  ownership: 'COO',
  show: 'Exhibition',
};

function formatMoneyCents(cents: number): string {
  if (cents === 0) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toLocaleString()}`;
  }
}

interface BreakdownRowProps {
  row: BreakdownRow;
  artworkHref?: string;
}

export function BreakdownRowComponent({ row, artworkHref }: BreakdownRowProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { current_value: cv } = row;
  const certLabel = row.certificate_type ? (CERT_LABELS[row.certificate_type] ?? row.certificate_type) : null;

  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-lg border border-wine/10 bg-parchment/40 hover:bg-parchment/70 transition-colors">
      {/* Thumbnail */}
      <div className="h-16 w-16 shrink-0 rounded-md overflow-hidden bg-ink/5 border border-wine/10 flex items-center justify-center">
        {row.image_url ? (
          <Image
            src={row.image_url}
            alt={row.title}
            width={64}
            height={64}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="h-6 w-6 text-ink/20" />
        )}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {artworkHref ? (
            <Link
              href={artworkHref}
              className="font-serif font-semibold text-ink hover:text-wine truncate"
            >
              {row.title}
            </Link>
          ) : (
            <span className="font-serif font-semibold text-ink truncate">{row.title}</span>
          )}
          {certLabel && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-wine/20 bg-wine/5 px-2 py-0.5 text-[10px] font-serif text-wine/70">
              {certLabel}
            </span>
          )}
        </div>
        {row.artist_name && (
          <p className="text-xs font-serif text-ink/50 mt-0.5 truncate">{row.artist_name}</p>
        )}
      </div>

      {/* Value + source */}
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        <p className="text-lg font-display font-bold text-wine tabular-nums">
          {formatMoneyCents(cv.value_cents)}
        </p>

        <div className="relative flex items-center gap-1">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-serif ${SOURCE_STYLES[cv.source]}`}
          >
            {SOURCE_LABEL[cv.source]}
          </span>

          <button
            type="button"
            aria-label="Why this value?"
            onClick={() => setPopoverOpen((o) => !o)}
            className="text-ink/30 hover:text-wine transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
          </button>

          {popoverOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setPopoverOpen(false)}
              />
              {/* Popover */}
              <div className="absolute right-0 bottom-full mb-2 z-50 w-64 rounded-lg border border-wine/20 bg-white shadow-lg p-3 text-left">
                <p className="text-xs font-serif font-semibold text-ink mb-1">Why this value?</p>
                <p className="text-xs font-serif text-ink/70 leading-relaxed">{cv.reasoning}</p>
                {cv.source === 'formal_valuation' && cv.low_cents !== cv.high_cents && (
                  <p className="text-[11px] font-serif text-ink/45 mt-1.5">
                    Confidence range: {formatMoneyCents(cv.low_cents)} – {formatMoneyCents(cv.high_cents)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
