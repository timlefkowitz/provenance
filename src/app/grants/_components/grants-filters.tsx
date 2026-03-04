'use client';

import { useState } from 'react';
import { Button } from '@kit/ui/button';
import type { ArtistGrantRow } from '../_actions/get-artist-grants';

export type SortField = 'deadline' | 'amount' | 'name';
export type LocationFilter = string | 'all';

type GrantsFiltersProps = {
  grants: ArtistGrantRow[];
  artistLocation: string | null;
  onSortChange?: (field: SortField) => void;
  onLocationFilterChange?: (location: LocationFilter) => void;
};

export function GrantsFilters({
  grants,
  artistLocation,
  onSortChange,
  onLocationFilterChange,
}: GrantsFiltersProps) {
  const [sortField, setSortField] = useState<SortField>('deadline');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');

  const locations = Array.from(
    new Set(grants.flatMap((g) => g.eligible_locations || []).filter(Boolean))
  ).sort();

  const handleSort = (field: SortField) => {
    setSortField(field);
    onSortChange?.(field);
  };

  const handleLocation = (loc: LocationFilter) => {
    setLocationFilter(loc);
    onLocationFilterChange?.(loc);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <span className="text-sm font-serif text-ink/70">Sort by:</span>
      <div className="flex gap-2">
        <Button
          variant={sortField === 'deadline' ? 'default' : 'outline'}
          size="sm"
          className="font-serif text-xs"
          onClick={() => handleSort('deadline')}
        >
          Deadline
        </Button>
        <Button
          variant={sortField === 'amount' ? 'default' : 'outline'}
          size="sm"
          className="font-serif text-xs"
          onClick={() => handleSort('amount')}
        >
          Amount
        </Button>
        <Button
          variant={sortField === 'name' ? 'default' : 'outline'}
          size="sm"
          className="font-serif text-xs"
          onClick={() => handleSort('name')}
        >
          Name
        </Button>
      </div>
      {locations.length > 0 && (
        <>
          <span className="text-sm font-serif text-ink/70 ml-2">Location:</span>
          <select
            value={locationFilter}
            onChange={(e) => handleLocation(e.target.value as LocationFilter)}
            className="border border-wine/30 rounded px-2 py-1 text-sm font-serif bg-parchment text-ink"
          >
            <option value="all">All locations</option>
            {artistLocation && (
              <option value={artistLocation}>My location ({artistLocation})</option>
            )}
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
