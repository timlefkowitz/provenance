'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OPEN_CALL_MEDIUMS } from '../../_actions/open-call-constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { Label } from '@kit/ui/label';
import { Input } from '@kit/ui/input';
import { Checkbox } from '@kit/ui/checkbox';
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
  const locationOnly = searchParams.get('location') === 'my';

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
      if (updates.location) next.set('location', updates.location);
      else next.delete('location');
    }
    const query = next.toString();
    router.push(`/open-calls/browse${query ? `?${query}` : ''}`);
  };

  const handleSearchSubmit = () => {
    setParams({ q: searchInput.trim() || undefined });
  };

  return (
    <div className="flex flex-wrap items-end gap-4 mb-6">
      <div className="space-y-2 flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-sm font-serif text-ink/80">Search</Label>
          <Input
            type="search"
            placeholder="Title, description, gallery..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchSubmit();
              }
            }}
            className="font-serif w-[220px]"
          />
        </div>
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
      <div className="space-y-2">
        <Label className="text-sm font-serif text-ink/80">Medium</Label>
        <Select
          value={medium}
          onValueChange={(value) => setParams({ medium: value })}
        >
          <SelectTrigger className="font-serif w-[160px]">
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
      {artistLocation && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="location-filter"
            checked={locationOnly}
            onCheckedChange={(checked) =>
              setParams({ location: checked ? 'my' : '' })
            }
          />
          <Label
            htmlFor="location-filter"
            className="text-sm font-serif text-ink/80 cursor-pointer"
          >
            Only where I qualify (e.g. {artistLocation})
          </Label>
        </div>
      )}
    </div>
  );
}
