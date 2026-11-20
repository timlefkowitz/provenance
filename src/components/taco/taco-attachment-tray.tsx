'use client';

/* eslint-disable @next/next/no-img-element -- local object URLs */

import { AlertCircle, FileText, Loader2, X } from 'lucide-react';

import type { PendingAttachment } from './use-taco-attachments';

export function TacoAttachmentTray({
  items,
  onRemove,
}: {
  items: PendingAttachment[];
  onRemove: (localId: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((a) => (
        <div
          key={a.localId}
          title={a.error ?? a.name}
          className={`group relative inline-flex items-center gap-1.5 rounded-lg border bg-white/80 px-2 py-1 font-serif text-xs shadow-xs ${
            a.status === 'error' ? 'border-red-300 text-red-700' : 'border-wine/20 text-ink/70'
          }`}
        >
          {a.status === 'uploading' ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-wine/60" />
          ) : a.status === 'error' ? (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          ) : a.previewUrl ? (
            <img src={a.previewUrl} alt="" className="h-5 w-5 rounded object-cover" />
          ) : (
            <FileText className="h-3.5 w-3.5 shrink-0 text-wine/60" />
          )}
          <span className="max-w-[110px] truncate">{a.status === 'error' ? a.error : a.name}</span>
          <button
            type="button"
            onClick={() => onRemove(a.localId)}
            className="ml-0.5 rounded-full p-0.5 text-ink/40 transition-colors hover:bg-wine/10 hover:text-wine"
            aria-label={`Remove ${a.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function TacoDropOverlay({ compact = false }: { compact?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-parchment/70 backdrop-blur-[1px]">
      <div className="rounded-2xl border-2 border-dashed border-wine/40 bg-parchment/95 px-8 py-5 text-center shadow-xl shadow-wine/10">
        <p className={`font-display text-wine ${compact ? 'text-base' : 'text-lg'}`}>Drop for Taco</p>
        <p className="mt-1 font-serif text-xs text-ink/55">
          Artwork photos, COAs, invoices, checklists, spreadsheets
        </p>
      </div>
    </div>
  );
}
