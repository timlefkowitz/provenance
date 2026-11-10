'use client';

import { useState } from 'react';

import { Printer } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';

import { EditorialDialogContent } from '~/components/editorial-dialog';
import { loadPriceSymbolPref, savePriceSymbolPref } from '~/lib/print-price';

import {
  DEFAULT_ZINE_OPTIONS,
  ZINE_STYLES,
  type ZineLayout,
  type ZineOptions,
  type ZineStyle,
  zinePlan,
} from '../_helpers/zine-print-html';

type ToggleKey = 'descriptions' | 'index' | 'prices' | 'priceSymbol';

const TOGGLES: Array<{
  key: ToggleKey;
  label: string;
  hint?: string;
  requires?: ToggleKey;
}> = [
  {
    key: 'descriptions',
    label: 'Descriptions',
    hint: 'Shortened to fit the page',
  },
  { key: 'index', label: 'Index', hint: 'Every work, before the back cover' },
  { key: 'prices', label: 'Prices' },
  {
    key: 'priceSymbol',
    label: 'Dollar sign',
    hint: 'Show $ before prices',
    requires: 'prices',
  },
];

const LAYOUTS: Array<{ value: ZineLayout; label: string; hint: string }> = [
  {
    value: 'booklet',
    label: 'Fold & staple',
    hint: 'Two pages to a Letter sheet, in booklet order',
  },
  {
    value: 'pages',
    label: 'Single pages',
    hint: '5.5 × 8.5in, one per sheet, for a print shop',
  },
];

function loadOptions(key: string): ZineOptions {
  const priceSymbol = loadPriceSymbolPref();
  try {
    const raw = window.localStorage.getItem(key);
    if (raw)
      return {
        ...DEFAULT_ZINE_OPTIONS,
        ...(JSON.parse(raw) as Partial<ZineOptions>),
        priceSymbol,
      };
  } catch {
    // storage unavailable
  }
  return { ...DEFAULT_ZINE_OPTIONS, priceSymbol };
}

/** A tiny spread of each style, so the choice is visual. */
function ZineThumb({ style }: { style: ZineStyle }) {
  if (style === 'riso') {
    return (
      <div className="flex h-24 gap-px bg-[#fbf8f1] p-1" aria-hidden="true">
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute top-[12%] left-[18%] h-[52%] w-[70%] bg-[#0078bf]" />
          <div className="absolute top-[8%] left-[12%] h-[52%] w-[70%] bg-[#ff48b0] [background-image:radial-gradient(circle,#fbf8f1_30%,transparent_34%)] [background-size:4px_4px] mix-blend-multiply" />
          <span className="absolute right-[8%] bottom-[14%] left-[8%] text-[11px] leading-none font-black text-[#0078bf] uppercase mix-blend-multiply">
            Title
          </span>
          <span className="absolute right-[6%] bottom-[6%] h-3 w-3 rounded-full bg-[#ff48b0]" />
        </div>
        <div className="relative flex-1 overflow-hidden">
          <span className="absolute top-[4%] left-[6%] z-10 text-[15px] leading-none font-black text-[#ff48b0] mix-blend-multiply">
            01
          </span>
          <div className="absolute top-[24%] left-[22%] h-[44%] w-[62%] bg-[#ff48b0]" />
          <div className="absolute top-[20%] left-[18%] h-[44%] w-[62%] bg-[#0078bf] mix-blend-multiply" />
          <span className="absolute bottom-[12%] left-[10%] h-[3px] w-[60%] bg-[#0078bf]" />
        </div>
      </div>
    );
  }
  if (style === 'xerox') {
    return (
      <div className="flex h-24 gap-px bg-[#e6e2d9] p-1" aria-hidden="true">
        <div className="relative flex-1 overflow-hidden bg-[#efece5]">
          <div className="absolute top-[10%] left-[10%] h-[40%] w-[50%] -rotate-6 border-2 border-white bg-[#555] shadow-sm" />
          <div className="absolute top-[22%] right-[8%] h-[40%] w-[46%] rotate-3 border-2 border-white bg-[#2a2a2a] shadow-sm" />
          <div className="absolute bottom-[12%] left-[8%] flex gap-px">
            {['Z', 'I', 'N', 'E'].map((c, i) => (
              <span
                key={c}
                className={`px-[2px] text-[9px] leading-tight ${i % 2 ? 'bg-white text-black' : 'bg-black text-white'}`}
                style={{ transform: `rotate(${i % 2 ? 4 : -3}deg)` }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="relative flex-1 overflow-hidden bg-[#efece5]">
          <div className="absolute top-[14%] left-[16%] h-[50%] w-[66%] rotate-2 border-2 border-white bg-[#3a3a3a] shadow-sm" />
          <div className="absolute top-[9%] left-[34%] h-[8%] w-[34%] -rotate-3 bg-[#e2dab0]/90" />
          <span className="absolute bottom-[16%] left-[10%] h-[5px] w-[60%] -rotate-1 bg-black" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-24 gap-px bg-[#0d0c0b] p-1" aria-hidden="true">
      <div className="relative flex-1 overflow-hidden bg-gradient-to-br from-[#4a3b2f] to-[#1b1714]">
        <div className="absolute top-[10%] left-[8%] h-[44%] w-[46%] -rotate-6 border border-[#f4efe6] bg-[#8b6b4d]" />
        <div className="absolute top-[18%] right-[6%] h-[44%] w-[44%] rotate-6 border border-[#f4efe6] bg-[#5f7a86]" />
        <span className="font-fraunces absolute bottom-[12%] left-[8%] text-[11px] leading-none text-[#f4efe6] italic">
          Title
        </span>
      </div>
      <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-[#6a5440] via-[#2a221c] to-[#0d0c0b]">
        <div className="absolute top-[22%] -right-[20%] h-[40%] w-[50%] rotate-6 bg-[#5f7a86]/40" />
        <div className="absolute top-[10%] left-[22%] h-[46%] w-[56%] bg-[#a3805c] shadow-[0_4px_8px_rgba(0,0,0,0.6)]" />
        <span className="font-fraunces absolute bottom-[20%] left-[12%] text-[9px] leading-none text-[#d6a841] italic">
          No. 01
        </span>
        <span className="absolute bottom-[12%] left-[12%] h-[2px] w-[50%] bg-[#f4efe6]/70" />
      </div>
    </div>
  );
}

/**
 * Zine options: one of three looks, booklet or single pages, and what goes
 * in. Used by the exhibition and collection print menus.
 */
type ZineDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of works in the zine. */
  count: number;
  optionsStorageKey: string;
  /** Whether any work has a price that may be printed. */
  hasPrices: boolean;
  /** Whether an introduction page will print (the show's description). */
  hasIntro: boolean;
  /** The gallery, institution or owner name for the cover. */
  ownerName?: string | null;
  onPrint: (options: ZineOptions) => void;
};

export function ZineDialog(props: ZineDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* Mounted per opening, so the saved options load fresh each time. */}
      {props.open && <ZineDialogBody {...props} />}
    </Dialog>
  );
}

function ZineDialogBody({
  onOpenChange,
  count,
  optionsStorageKey,
  hasPrices,
  hasIntro,
  ownerName,
  onPrint,
}: ZineDialogProps) {
  const [options, setOptions] = useState<ZineOptions>(() =>
    loadOptions(optionsStorageKey),
  );

  const toggles = TOGGLES.filter(
    (t) => (t.key !== 'prices' && t.key !== 'priceSymbol') || hasPrices,
  );
  const plan = zinePlan(count, {
    hasIntro,
    index: options.index,
    layout: options.layout,
  });

  const handlePrint = () => {
    try {
      window.localStorage.setItem(optionsStorageKey, JSON.stringify(options));
    } catch {
      // ignore
    }
    savePriceSymbolPref(options.priceSymbol);
    console.log('[Zine] Print', {
      style: options.style,
      layout: options.layout,
      count,
      pages: plan.pages,
    });
    onPrint({ ...options, prices: options.prices && hasPrices });
    onOpenChange(false);
  };

  const section =
    'mb-2 font-serif text-[10px] uppercase tracking-widest text-ink/40';
  const choice = (on: boolean) =>
    `border p-2 text-left font-serif transition-colors ${on ? 'border-wine bg-wine/10' : 'border-wine/20 hover:border-wine/40'}`;

  return (
    <EditorialDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Zine</DialogTitle>
        <DialogDescription>
          A small booklet of the work: one piece to a page, half-letter size.
        </DialogDescription>
      </DialogHeader>

      <div>
        <p className={section}>Style</p>
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Zine style"
        >
          {ZINE_STYLES.map((s) => {
            const on = options.style === s.value;
            return (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setOptions((o) => ({ ...o, style: s.value }))}
                className={`flex flex-col gap-2 ${choice(on)}`}
              >
                <ZineThumb style={s.value} />
                <span className={`text-sm ${on ? 'text-wine' : 'text-ink'}`}>
                  {s.label}
                  <span className="text-ink/45 block text-[11px] leading-tight">
                    {s.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={section}>Printing</p>
        <div
          className="grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Zine layout"
        >
          {LAYOUTS.map((l) => {
            const on = options.layout === l.value;
            return (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setOptions((o) => ({ ...o, layout: l.value }))}
                className={`text-sm ${choice(on)} ${on ? 'text-wine' : 'text-ink'}`}
              >
                {l.label}
                <span className="text-ink/45 block text-[11px] leading-tight">
                  {l.hint}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-ink/60 mt-2 font-serif text-xs">
          {plan.pages} pages
          {options.layout === 'booklet' ? (
            <>
              {' '}
              on {plan.sheets} {plan.sheets === 1 ? 'sheet' : 'sheets'} of
              Letter. Print on both sides,{' '}
              <span className="text-ink">flip on short edge</span>, then fold
              the stack in half and staple the spine.
            </>
          ) : (
            '.'
          )}
        </p>
      </div>

      <div>
        <p className={section}>Name on cover</p>
        <div
          className="grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Name on cover"
        >
          {(
            [
              {
                value: 'owner',
                label: ownerName?.trim() || 'Your name',
                hint: 'Gallery or owner',
              },
              { value: 'provenance', label: 'Provenance', hint: 'Our brand' },
            ] as const
          ).map((c) => {
            const on = options.coverName === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() =>
                  setOptions((o) => ({ ...o, coverName: c.value }))
                }
                className={`text-sm ${choice(on)} ${on ? 'text-wine' : 'text-ink'}`}
              >
                <span className="block truncate">{c.label}</span>
                <span className="text-ink/45 block text-[11px] leading-tight">
                  {c.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={section}>Include</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {toggles.map(({ key, label, hint, requires }) => {
            const disabled = requires ? !options[requires] : false;
            return (
              <div
                key={key}
                className={`flex items-start gap-2 ${disabled ? 'opacity-40' : ''}`}
              >
                <Checkbox
                  id={`zine-${key}`}
                  checked={options[key]}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    setOptions((o) => ({ ...o, [key]: checked === true }))
                  }
                  className="border-wine/30 mt-0.5"
                />
                <Label
                  htmlFor={`zine-${key}`}
                  className="cursor-pointer font-serif text-sm leading-tight"
                >
                  {label}
                  {hint && (
                    <span className="text-ink/40 block text-[11px] font-normal">
                      {hint}
                    </span>
                  )}
                </Label>
              </div>
            );
          })}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handlePrint} disabled={count === 0}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          Print zine
        </Button>
      </DialogFooter>
    </EditorialDialogContent>
  );
}
