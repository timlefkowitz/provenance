'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
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

export function ArtworksSearchBar({
  mediums,
}: {
  mediums: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const medium = searchParams.get('medium') ?? '';

  const [searchValue, setSearchValue] = useState(q);
  const [mediumValue, setMediumValue] = useState(medium);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchValue.trim()) params.set('q', searchValue.trim());
    if (mediumValue) params.set('medium', mediumValue);
    const s = params.toString();
    router.push(s ? `/artworks?${s}` : '/artworks');
  };

  const clearFilters = () => {
    setSearchValue('');
    setMediumValue('');
    router.push('/artworks');
  };

  const hasFilters = q || medium;

  return (
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
  );
}
