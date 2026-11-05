'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@kit/ui/utils';
import {
  POSTER_FIELDS,
  type PosterField,
  type PosterOverrides,
  type PosterText,
} from '../_helpers/poster-text';

const MULTILINE = new Set<PosterField>(['title', 'sub']);

/**
 * Collapsible editor for every line of the exhibition QR poster. Shows each
 * line's current text (the edit, or the default from the exhibition); clearing
 * a line leaves it off the poster, and Reset brings the default back.
 */
export function PosterTextEditor({
  defaults,
  overrides,
  onChange,
}: {
  defaults: PosterText;
  overrides: PosterOverrides;
  onChange: (next: PosterOverrides) => void;
}) {
  const edited = Object.keys(overrides).length;
  const [open, setOpen] = useState(false);

  const setField = (key: PosterField, value: string) => {
    const next = { ...overrides };
    if (value === defaults[key]) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const resetField = (key: PosterField) => {
    const next = { ...overrides };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="rounded-md border border-wine/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-serif text-sm text-ink/80"
      >
        <span>
          Poster text
          {edited > 0 && (
            <span className="ml-2 text-[11px] text-ink/45">
              {edited} {edited === 1 ? 'line' : 'lines'} edited
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-ink/40 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-wine/10 px-3 pb-3 pt-2.5">
          <p className="text-[11px] font-serif text-ink/45">
            Change any line of the printed poster. Clear a line to leave it off. The QR code still
            opens this exhibition whatever the link text says.
          </p>
          {POSTER_FIELDS.map((field) => {
            const value = overrides[field.key] ?? defaults[field.key];
            const isEdited = overrides[field.key] !== undefined;
            const inputClass =
              'mt-1 block w-full rounded-md border border-wine/20 bg-white px-2 py-1.5 font-serif text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-wine/30';
            return (
              <div key={field.key}>
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor={`poster-${field.key}`}
                    className="text-[10px] uppercase tracking-widest text-ink/45 font-serif"
                  >
                    {field.label}
                  </label>
                  {isEdited && (
                    <button
                      type="button"
                      onClick={() => resetField(field.key)}
                      className="text-[11px] font-serif text-ink/45 underline hover:text-ink"
                    >
                      Reset
                    </button>
                  )}
                </div>
                {MULTILINE.has(field.key) ? (
                  <textarea
                    id={`poster-${field.key}`}
                    rows={2}
                    value={value}
                    maxLength={field.max}
                    placeholder="Left off the poster"
                    onChange={(e) => setField(field.key, e.target.value)}
                    className={cn(inputClass, 'resize-y')}
                  />
                ) : (
                  <input
                    id={`poster-${field.key}`}
                    type="text"
                    value={value}
                    maxLength={field.max}
                    placeholder="Left off the poster"
                    onChange={(e) => setField(field.key, e.target.value)}
                    className={inputClass}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
