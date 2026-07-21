'use client';

/**
 * EditableCta
 *
 * Wraps the CTA button in edit mode with a click affordance that opens a
 * small inline popover to edit the label and URL, then posts changes up.
 *
 * On public sites, renders children unchanged.
 */

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { useSiteEdit } from './site-edit-context';
import type { SiteCta } from '../types';

type Props = {
  cta: SiteCta | null;
  children: ReactNode;
};

export function EditableCta({ cta, children }: Props) {
  const { isEditMode, postUp } = useSiteEdit();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(cta?.label ?? '');
  const [url, setUrl] = useState(cta?.url ?? '');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sync if cta changes from bridge
  useEffect(() => {
    setLabel(cta?.label ?? '');
    setUrl(cta?.url ?? '');
  }, [cta?.label, cta?.url]);

  if (!isEditMode) {
    return <>{children}</>;
  }

  function commit() {
    if (!label.trim() || !url.trim()) return;
    console.log('[SiteEdit] EditableCta commit', { label, url });
    postUp({ type: 'EDIT_CTA', payload: { label: label.trim(), url: url.trim() } });
    setOpen(false);
  }

  return (
    <div className="relative inline-flex items-center gap-1">
      {children}

      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Edit CTA"
        className="p-1 rounded-full"
        style={{
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(0,0,0,0.1)',
          color: '#444',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}
      >
        <Pencil size={11} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute z-[9999] top-full mt-2 left-0 flex flex-col gap-2"
          style={{
            background: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: '10px',
            padding: '10px 12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            minWidth: '220px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Button
          </p>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Shop now)"
            className="text-xs border rounded px-2 py-1.5 w-full outline-none focus:border-gray-400"
            style={{ fontFamily: 'system-ui, sans-serif' }}
            autoFocus
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-shop.com"
            className="text-xs border rounded px-2 py-1.5 w-full outline-none focus:border-gray-400"
            style={{ fontFamily: 'system-ui, sans-serif' }}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
          />
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={commit}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: '#4A2F25', color: '#fff' }}
            >
              <Check size={11} /> Apply
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded"
              style={{ background: '#f3f3f3', color: '#666' }}
            >
              <X size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
