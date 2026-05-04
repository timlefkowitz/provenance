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
          'group flex w-full items-center justify-between rounded-md px-0 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        }
        aria-expanded={open}
      >
        <span className="text-lg font-semibold tracking-tight">{label}</span>

        <ChevronDown
          className={[
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300',
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
