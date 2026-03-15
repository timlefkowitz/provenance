'use client';

import { useState, useMemo } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import type { ArtistGrantRow } from '../_actions/get-artist-grants';
import { OPEN_CALL_MEDIUMS } from '~/app/open-calls/_actions/open-call-constants';

export type SortField = 'deadline' | 'amount' | 'name';
export type LocationFilter = string | 'all' | 'none';

type GrantsFiltersProps = {
  grants: ArtistGrantRow[];
  artistLocation: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  mediumFilter: string;
  onMediumFilterChange: (medium: string) => void;
  locationFilter: LocationFilter;
  onLocationFilterChange: (location: LocationFilter) => void;
  onSortChange?: (field: SortField) => void;
};

export function GrantsFilters({
  grants,
  artistLocation,
  searchQuery,
  onSearchChange,
  mediumFilter,
  onMediumFilterChange,
  locationFilter,
  onLocationFilterChange,
  onSortChange,
}: GrantsFiltersProps) {
  const [sortField, setSortField] = useState<SortField>('deadline');

  const locations = useMemo(
    () =>
      Array.from(
        new Set(grants.flatMap((g) => g.eligible_locations || []).filter(Boolean))
      ).sort(),
    [grants]
  );

  const handleSort = (field: SortField) => {
    setSortField(field);
    onSortChange?.(field);
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Search + Medium + Location bar */}
      <div className="rounded-lg border border-wine/20 bg-parchment/40 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1 min-w-[200px] flex-1 max-w-md">
            <Label className="text-sm font-serif text-ink/80">Search</Label>
            <Input
              type="search"
              placeholder="Name, description, discipline, amount..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="font-serif"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-serif text-ink/80">Medium / discipline</Label>
            <Select value={mediumFilter} onValueChange={onMediumFilterChange}>
              <SelectTrigger className="font-serif w-[180px]">
                <SelectValue placeholder="All mediums" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All mediums</SelectItem>
                {OPEN_CALL_MEDIUMS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-serif text-ink/80">Location</Label>
            <Select
              value={locationFilter}
              onValueChange={(v) => onLocationFilterChange(v as LocationFilter)}
            >
              <SelectTrigger className="font-serif w-[220px]">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                <SelectItem value="none">No location requirement</SelectItem>
                {artistLocation && (
                  <SelectItem value={artistLocation}>My location ({artistLocation})</SelectItem>
                )}
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Sort */}
      <div className="flex flex-wrap items-center gap-3">
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
      </div>
    </div>
  );
}
