'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export type ArtworkFilter = 'recent' | 'trending' | 'diverse' | 'favorites';

const FILTERS: { value: ArtworkFilter; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'trending', label: 'Trending' },
  { value: 'diverse', label: 'Diverse' },
  { value: 'favorites', label: 'Most Favorited' },
];

export function ArtworksFilterBar({ activeFilter }: { activeFilter: ArtworkFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setFilter = useCallback(
    (filter: ArtworkFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('filter', filter);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex gap-1 p-1 bg-parchment/60 border border-wine/15 rounded-lg w-fit">
      {FILTERS.map(({ value, label }) => {
        const isActive = activeFilter === value;
        return (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={[
              'px-4 py-1.5 rounded-md text-sm font-serif transition-all duration-150',
              isActive
                ? 'bg-wine text-parchment shadow-sm'
                : 'text-ink/60 hover:text-ink hover:bg-wine/8',
            ].join(' ')}
            aria-pressed={isActive}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
