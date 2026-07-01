'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckSquare, Square } from 'lucide-react';
import { formatCategoryLabel, type CollectibleRow } from '~/lib/collectibles/constants';
import { formatMoneyCents, parseDeclaredValueCents } from '~/lib/collectibles/value';
import { PrintCollectibleQRSheet } from './print-collectible-qr-sheet';

export function MyCollectiblesGrid({ collectibles }: { collectibles: CollectibleRow[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const totalValueCents = useMemo(
    () => collectibles.reduce((sum, c) => sum + parseDeclaredValueCents(c.value), 0),
    [collectibles],
  );

  const valuedCount = useMemo(
    () => collectibles.filter((c) => parseDeclaredValueCents(c.value) > 0).length,
    [collectibles],
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = selectedIds.size === collectibles.length && collectibles.length > 0;
  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(collectibles.map((c) => c.id)));
  };

  return (
    <div className="space-y-6">
      {/* Collection value */}
      <div className="rounded-2xl border border-wine/20 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-ink/50 font-serif mb-1">
              Collection Value
            </p>
            <p className="font-display text-4xl font-bold text-wine">
              {formatMoneyCents(totalValueCents)}
            </p>
            <p className="text-sm text-ink/60 font-serif mt-1">
              Across {collectibles.length} collectible{collectibles.length === 1 ? '' : 's'}
              {valuedCount < collectibles.length && (
                <span> · {collectibles.length - valuedCount} without a value yet</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 text-sm font-serif text-ink/70 hover:text-wine transition-colors"
            >
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            <PrintCollectibleQRSheet collectibles={collectibles} selectedIds={selectedIds} />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {collectibles.map((c) => {
          const selected = selectedIds.has(c.id);
          const valueCents = parseDeclaredValueCents(c.value);
          return (
            <div
              key={c.id}
              className={`relative rounded-xl border bg-white overflow-hidden transition-colors ${
                selected ? 'border-wine ring-2 ring-wine/30' : 'border-wine/15 hover:border-wine/40'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className="absolute top-2 left-2 z-10 rounded-md bg-white/90 border border-wine/20 p-1 text-wine shadow-sm"
                aria-label={selected ? 'Deselect' : 'Select'}
              >
                {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </button>
              <Link href={`/collectibles/${c.id}/certificate`} className="block">
                <div className="aspect-square bg-parchment">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt={c.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink/30 font-serif">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-serif font-semibold text-ink truncate">{c.title}</p>
                  <p className="text-xs text-ink/60 font-serif">
                    {c.category ? formatCategoryLabel(c.category) : 'Collectible'}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] font-mono text-ink/50">
                      {c.certificate_number ?? ''}
                    </span>
                    {valueCents > 0 && (
                      <span className="text-sm font-display text-wine">
                        {formatMoneyCents(valueCents)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
