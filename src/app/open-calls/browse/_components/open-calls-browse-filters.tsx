'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OPEN_CALL_MEDIUMS } from '../../_actions/open-call-constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { Label } from '@kit/ui/label';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';

type Props = {
  artistLocation: string | null;
};

export function OpenCallsBrowseFilters({ artistLocation }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(qFromUrl);
  useEffect(() => setSearchInput(qFromUrl), [qFromUrl]);
  const medium = searchParams.get('medium') ?? 'all';
  const locationParam = searchParams.get('location') ?? 'all'; // 'all' | 'my' | 'none'

  const setParams = (updates: { q?: string; medium?: string; location?: string }) => {
    const next = new URLSearchParams(searchParams.toString());
    if (updates.q !== undefined) {
      if (updates.q) next.set('q', updates.q);
      else next.delete('q');
    }
    if (updates.medium !== undefined) {
      if (updates.medium && updates.medium !== 'all') next.set('medium', updates.medium);
      else next.delete('medium');
    }
    if (updates.location !== undefined) {
      if (updates.location && updates.location !== 'all') next.set('location', updates.location);
      else next.delete('location');
    }
    const query = next.toString();
    router.push(`/open-calls/browse${query ? `?${query}` : ''}`);
  };

  const handleSearchSubmit = () => {
    setParams({ q: searchInput.trim() || undefined });
  };

  return (
    <div className="rounded-lg border border-wine/20 bg-parchment/40 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1 min-w-[200px] flex-1 max-w-md">
          <Label className="text-sm font-serif text-ink/80">Search</Label>
          <div className="flex gap-2">
            <Input
              type="search"
              placeholder="Title, description, gallery, or medium..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
              className="font-serif flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="default"
              className="font-serif shrink-0"
              onClick={handleSearchSubmit}
            >
              Search
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-serif text-ink/80">Medium</Label>
          <Select
            value={medium}
            onValueChange={(value) => setParams({ medium: value })}
          >
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
            value={locationParam}
            onValueChange={(value) => setParams({ location: value })}
          >
            <SelectTrigger className="font-serif w-[240px]">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {artistLocation ? (
                <SelectItem value="my">
                  Only where I qualify ({artistLocation})
                </SelectItem>
              ) : null}
              <SelectItem value="none">No location requirement</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
