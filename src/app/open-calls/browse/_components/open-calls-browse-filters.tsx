'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { OPEN_CALL_TYPES } from '../../_actions/open-call-constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { Label } from '@kit/ui/label';
import { Checkbox } from '@kit/ui/checkbox';

type Props = {
  artistLocation: string | null;
};

export function OpenCallsBrowseFilters({ artistLocation }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get('type') ?? 'all';
  const locationOnly = searchParams.get('location') === 'my';

  const setParams = (updates: { type?: string; location?: string }) => {
    const next = new URLSearchParams(searchParams.toString());
    if (updates.type !== undefined) next.set('type', updates.type);
    if (updates.location !== undefined) {
      if (updates.location) next.set('location', updates.location);
      else next.delete('location');
    }
    const q = next.toString();
    router.push(`/open-calls/browse${q ? `?${q}` : ''}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-4 mb-6">
      <div className="space-y-2">
        <Label className="text-sm font-serif text-ink/80">Type</Label>
        <Select
          value={type}
          onValueChange={(value) => setParams({ type: value })}
        >
          <SelectTrigger className="font-serif w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {OPEN_CALL_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
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
            Only show where I qualify (e.g. {artistLocation})
          </Label>
        </div>
      )}
    </div>
  );
}
