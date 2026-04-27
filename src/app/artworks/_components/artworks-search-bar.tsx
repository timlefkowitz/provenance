'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search, Users, Heart, TrendingUp } from 'lucide-react';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';

type ViewMode = 'artist' | 'top' | 'trending';

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: React.ElementType }[] = [
  { value: 'artist', label: 'By Artist', icon: Users },
  { value: 'top', label: 'Top Favorited', icon: Heart },
  { value: 'trending', label: 'Trending', icon: TrendingUp },
];

export function ArtworksSearchBar({
  mediums,
  currentView = 'artist',
}: {
  mediums: string[];
  currentView?: ViewMode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const medium = searchParams.get('medium') ?? '';

  const [searchValue, setSearchValue] = useState(q);
  const [mediumValue, setMediumValue] = useState(medium);

  const navigateTo = (overrides: Partial<{ view: ViewMode; q: string; medium: string }>) => {
    const params = new URLSearchParams();
    const nextView = overrides.view ?? currentView;
    const nextQ = overrides.q !== undefined ? overrides.q : searchValue.trim();
    const nextMedium = overrides.medium !== undefined ? overrides.medium : mediumValue;

    // 'artist' is the default — omit from URL to keep it clean.
    if (nextView !== 'artist') params.set('view', nextView);
    if (nextQ) params.set('q', nextQ);
    if (nextMedium) params.set('medium', nextMedium);

    const s = params.toString();
    router.push(s ? `/artworks?${s}` : '/artworks');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo({});
  };

  const clearFilters = () => {
    setSearchValue('');
    setMediumValue('');
    navigateTo({ q: '', medium: '' });
  };

  const hasFilters = q || medium;

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div
        role="group"
        aria-label="View mode"
        className="inline-flex items-center rounded-lg border border-wine/20 bg-parchment/40 p-0.5 gap-0.5"
      >
        {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => navigateTo({ view: value })}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-serif transition-all',
              currentView === value
                ? 'bg-wine text-parchment shadow-sm'
                : 'text-ink/60 hover:text-ink hover:bg-wine/5',
            )}
            aria-pressed={currentView === value}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* Search + Medium Filter */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
          <div className="flex-1 relative">
            <Label htmlFor="artworks-search" className="sr-only">
              Search artworks by title or artist
            </Label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/50 pointer-events-none" />
            <Input
              id="artworks-search"
              type="search"
              placeholder="Search by title or artist..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9 font-serif border-wine/20 focus-visible:ring-wine/30"
              aria-label="Search by title or artist"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
            <div className="w-full sm:w-[200px]">
              <Label htmlFor="artworks-medium" className="sr-only">
                Filter by type or genre
              </Label>
              <Select
                value={mediumValue || 'all'}
                onValueChange={(v) => setMediumValue(v === 'all' ? '' : v)}
              >
                <SelectTrigger id="artworks-medium" className="font-serif border-wine/20">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-serif">
                    All types
                  </SelectItem>
                  {mediums.map((m) => (
                    <SelectItem key={m} value={m} className="font-serif">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="default"
                size="sm"
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              >
                Search
              </Button>
              {hasFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-serif border-wine/30 hover:bg-wine/10"
                  onClick={clearFilters}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
