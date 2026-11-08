'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSignUpSectionProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSignUpSection({
  label,
  children,
  defaultOpen = false,
}: CollapsibleSignUpSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          'group flex w-full items-center justify-between px-0 py-1 text-left transition-colors hover:text-vermillion focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion/30'
        }
        aria-expanded={open}
      >
        <span className="label-editorial text-[11px] font-medium">{label}</span>

        <ChevronDown
          className={[
            'h-4 w-4 shrink-0 text-editorial-ink/50 transition-transform duration-300',
            open ? 'rotate-180' : 'rotate-0',
          ].join(' ')}
        />
      </button>

      {/* Grid-rows trick: 0fr → 1fr gives a smooth height animation */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pt-4 space-y-2.5">{children}</div>
        </div>
      </div>
    </div>
  );
}
