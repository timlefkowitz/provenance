'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import {
  TEMPLATE_OPTIONS,
  type TemplateId,
} from './artist-templates';

type TemplateSwitcherProps = {
  current: TemplateId | null;
};

export function TemplateSwitcher({ current }: TemplateSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const setTemplate = useCallback(
    (templateId: TemplateId | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (templateId) {
        params.set('template', templateId);
      } else {
        params.delete('template');
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
      setOpen(false);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="rounded-lg border border-parchment/20 bg-ink/90 text-parchment backdrop-blur-md shadow-xl p-2 min-w-[160px] font-mono text-[11px]">
          <button
            type="button"
            onClick={() => setTemplate(null)}
            className={`w-full text-left px-3 py-2 rounded hover:bg-parchment/10 transition-colors ${
              current === null ? 'bg-wine/40 text-parchment' : 'text-parchment/80'
            }`}
          >
            Default
          </button>
          {TEMPLATE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTemplate(opt.id)}
              className={`w-full text-left px-3 py-2 rounded hover:bg-parchment/10 transition-colors ${
                current === opt.id ? 'bg-wine/40 text-parchment' : 'text-parchment/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-parchment/20 bg-ink/85 text-parchment backdrop-blur-md px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider shadow-lg hover:bg-ink transition-colors"
        aria-expanded={open}
        aria-label="Switch artist profile template"
      >
        {open ? <X className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
        <span>{current ? TEMPLATE_OPTIONS.find((t) => t.id === current)?.label : 'Templates'}</span>
      </button>
    </div>
  );
}
