'use client';

import { useState, useMemo } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { Bookmark, Globe, Search } from 'lucide-react';
import type { ArtistGrantRow } from '../_actions/get-artist-grants';
import { OPEN_CALL_MEDIUMS } from '~/app/open-calls/_actions/open-call-constants';

export type SortField = 'deadline' | 'amount' | 'name';
export type LocationFilter = string | 'all' | 'none';
export type BookmarkFilter = 'all' | 'saved' | 'community';

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
  bookmarkFilter: BookmarkFilter;
  onBookmarkFilterChange: (filter: BookmarkFilter) => void;
  savedCount: number;
  communityCount: number;
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
  bookmarkFilter,
  onBookmarkFilterChange,
  savedCount,
  communityCount,
}: GrantsFiltersProps) {
  const [sortField, setSortField] = useState<SortField>('deadline');

  const locations = useMemo(
    () =>
      Array.from(
        new Set(grants.flatMap((g) => g.eligible_locations || []).filter(Boolean)),
      ).sort(),
    [grants],
  );

  const handleSort = (field: SortField) => {
    setSortField(field);
    onSortChange?.(field);
  };

  const tabs: { id: BookmarkFilter; label: string; count: number; icon?: React.ReactNode }[] = [
    { id: 'all', label: 'All', count: grants.length },
    {
      id: 'saved',
      label: 'Saved',
      count: savedCount,
      icon: <Bookmark className="h-3.5 w-3.5" />,
    },
    {
      id: 'community',
      label: 'Community',
      count: communityCount,
      icon: <Globe className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* Tab filter row */}
      <div className="flex items-center gap-1.5 p-1 bg-parchment/60 rounded-xl border border-wine/10 w-fit">
        {tabs.map((tab) => {
          const active = bookmarkFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onBookmarkFilterChange(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-serif transition-all duration-200 ${
                active
                  ? 'bg-wine text-parchment shadow-sm'
                  : 'text-ink/60 hover:text-ink hover:bg-wine/8'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 font-sans ${
                  active ? 'bg-white/20 text-parchment' : 'bg-wine/10 text-wine/70'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Medium + Location bar */}
      <div className="rounded-xl border border-wine/15 bg-parchment/40 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1 min-w-[200px] flex-1 max-w-md">
            <Label className="text-xs font-serif text-ink/60 uppercase tracking-wide">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/40" />
              <Input
                type="search"
                placeholder="Name, description, discipline…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="font-serif pl-9 border-wine/20 focus:border-wine/50"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-serif text-ink/60 uppercase tracking-wide">
              Discipline
            </Label>
            <Select value={mediumFilter} onValueChange={onMediumFilterChange}>
              <SelectTrigger className="font-serif w-[180px] border-wine/20">
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
            <Label className="text-xs font-serif text-ink/60 uppercase tracking-wide">
              Location
            </Label>
            <Select
              value={locationFilter}
              onValueChange={(v) => onLocationFilterChange(v as LocationFilter)}
            >
              <SelectTrigger className="font-serif w-[220px] border-wine/20">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                <SelectItem value="none">No restriction</SelectItem>
                {artistLocation && (
                  <SelectItem value={artistLocation}>Near me ({artistLocation})</SelectItem>
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
        <span className="text-xs font-serif text-ink/50 uppercase tracking-wide">Sort by</span>
        <div className="flex gap-1.5">
          {(['deadline', 'amount', 'name'] as SortField[]).map((field) => (
            <Button
              key={field}
              variant={sortField === field ? 'default' : 'outline'}
              size="sm"
              className={`font-serif text-xs capitalize rounded-lg ${
                sortField === field
                  ? 'bg-wine text-parchment'
                  : 'border-wine/20 text-ink/60 hover:border-wine/40'
              }`}
              onClick={() => handleSort(field)}
            >
              {field}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
