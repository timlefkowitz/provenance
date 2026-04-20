'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@kit/ui/command';
import { cn } from '@kit/ui/utils';
import type { OperationsArtworkOption } from '../page';

type ExhibitionFilter = 'all' | 'unlinked' | string;

type Props = {
  artworks: OperationsArtworkOption[];
  value: string;
  onChange: (artworkId: string) => void;
  disabled?: boolean;
};

function formatExhibitionLabel(ex: { title: string; start_date: string | null }) {
  const y = ex.start_date ? new Date(ex.start_date).getFullYear() : null;
  return y ? `${ex.title} (${y})` : ex.title;
}

export function LoanArtworkPicker({ artworks, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [exhibitionFilter, setExhibitionFilter] = useState<ExhibitionFilter>('all');

  const exhibitionOptions = useMemo(() => {
    const m = new Map<string, { id: string; title: string; start_date: string | null }>();
    for (const a of artworks) {
      for (const ex of a.exhibitions) {
        if (!m.has(ex.id)) m.set(ex.id, ex);
      }
    }
    return [...m.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [artworks]);

  const filteredArtworks = useMemo(() => {
    if (exhibitionFilter === 'all') return artworks;
    if (exhibitionFilter === 'unlinked') {
      return artworks.filter((a) => a.exhibitions.length === 0);
    }
    return artworks.filter((a) => a.exhibitions.some((e) => e.id === exhibitionFilter));
  }, [artworks, exhibitionFilter]);

  const displayArtworks = useMemo(() => {
    const sel = artworks.find((a) => a.id === value);
    if (value && sel && !filteredArtworks.some((a) => a.id === value)) {
      return [sel, ...filteredArtworks];
    }
    return filteredArtworks;
  }, [artworks, filteredArtworks, value]);

  const selected = artworks.find((a) => a.id === value) ?? null;

  return (
    <div className="grid gap-2">
      <Label>Artwork</Label>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="grid gap-1.5">
          <span className="text-xs text-ink/60 font-serif">Filter by exhibition</span>
          <Select
            value={exhibitionFilter}
            onValueChange={(v) => setExhibitionFilter(v as ExhibitionFilter)}
            disabled={disabled}
          >
            <SelectTrigger className="font-serif">
              <SelectValue placeholder="All artworks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-serif">
                All artworks
              </SelectItem>
              <SelectItem value="unlinked" className="font-serif">
                Not in any exhibition
              </SelectItem>
              {exhibitionOptions.map((ex) => (
                <SelectItem key={ex.id} value={ex.id} className="font-serif">
                  {formatExhibitionLabel(ex)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5 sm:col-span-1">
          <span className="text-xs text-ink/60 font-serif">Select piece</span>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                disabled={disabled || artworks.length === 0}
                className={cn(
                  'w-full justify-between font-serif font-normal h-auto min-h-9 py-2 border-wine/20',
                  !selected && 'text-ink/50',
                )}
              >
                <span className="truncate text-left">
                  {selected ? (
                    <>
                      {selected.title}
                      {selected.artist_name ? (
                        <span className="text-ink/60 text-xs block truncate">— {selected.artist_name}</span>
                      ) : null}
                    </>
                  ) : (
                    'Search or choose artwork…'
                  )}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(calc(100vw-2rem),420px)] sm:w-[380px] p-0" align="start">
              <Command className="font-serif">
                <CommandInput placeholder="Search title or artist…" className="font-serif text-sm" />
                <CommandList className="max-h-[min(50vh,280px)]">
                  <CommandEmpty className="py-3 text-center text-sm text-ink/60">
                    No artworks match this filter or search.
                  </CommandEmpty>
                  <CommandGroup>
                    {displayArtworks.map((a) => {
                      const searchValue = [
                        a.title,
                        a.artist_name ?? '',
                        ...a.exhibitions.map((e) => e.title),
                        a.id,
                      ]
                        .join(' ')
                        .trim();
                      return (
                        <CommandItem
                          key={a.id}
                          value={searchValue}
                          onSelect={() => {
                            onChange(a.id);
                            setOpen(false);
                          }}
                          className="font-serif text-sm"
                        >
                          <Check
                            className={cn('mr-2 h-4 w-4 shrink-0', value === a.id ? 'opacity-100' : 'opacity-0')}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{a.title}</div>
                            {a.artist_name ? (
                              <div className="truncate text-xs text-ink/60">{a.artist_name}</div>
                            ) : null}
                            {a.exhibitions.length > 0 ? (
                              <div className="truncate text-xs text-ink/50 mt-0.5">
                                {a.exhibitions.map((e) => formatExhibitionLabel(e)).join(' · ')}
                              </div>
                            ) : null}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
