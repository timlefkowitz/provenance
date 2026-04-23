'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Mail, User } from 'lucide-react';

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

import { getRoleLabel, type UserRole } from '~/lib/user-roles';

export type SoldToValue = {
  accountId?: string | null;
  email?: string | null;
  name?: string | null;
};

export interface SoldToPickerProps {
  value: SoldToValue | null;
  onChange: (value: SoldToValue | null) => void;
  className?: string;
}

interface AccountOption {
  id: string;
  name: string;
  role: UserRole | null;
  picture_url: string | null;
  location: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SoldToPicker({ value, onChange, className }: SoldToPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AccountOption[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search-accounts?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as AccountOption[];
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          console.error('[SoldToPicker] search failed', err);
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    if (value.accountId) {
      const match = results.find((r) => r.id === value.accountId);
      if (match) return match.name;
      if (value.name) return value.name;
      return 'Platform account selected';
    }
    if (value.email) return value.email;
    if (value.name) return `${value.name} (off-platform)`;
    return null;
  }, [value, results]);

  const trimmedQuery = query.trim();
  const queryLooksLikeEmail = EMAIL_REGEX.test(trimmedQuery);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Select buyer"
          className={cn(
            'font-serif text-sm min-h-11 h-auto w-full max-w-full sm:h-9 sm:min-h-0 flex items-center justify-between rounded-md border border-wine/20 bg-background px-3 py-2 text-left',
            'hover:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/30 focus:ring-offset-2 focus:ring-offset-parchment',
            !selectedLabel && 'text-ink/50',
            className,
          )}
        >
          <span className="truncate">
            {selectedLabel ?? 'Select buyer (search, invite by email, or off-platform)'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-2rem),340px)] sm:w-[320px] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search users or galleries..."
            className="font-serif text-sm"
          />
          <CommandList>
            <CommandEmpty className="font-serif text-sm py-3 text-center text-ink/60">
              {loading ? 'Searching…' : trimmedQuery.length < 2 ? 'Type to search' : 'No matches'}
            </CommandEmpty>

            {value ? (
              <CommandGroup heading="Selected">
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="font-serif text-sm"
                >
                  <Check className="mr-2 h-4 w-4 opacity-100" />
                  Clear buyer
                </CommandItem>
              </CommandGroup>
            ) : null}

            {results.length > 0 ? (
              <CommandGroup heading="On platform">
                {results.map((acct) => {
                  const selected = value?.accountId === acct.id;
                  return (
                    <CommandItem
                      key={acct.id}
                      value={`acct:${acct.id}:${acct.name}`}
                      onSelect={() => {
                        onChange({ accountId: acct.id, name: acct.name });
                        setOpen(false);
                      }}
                      className="font-serif text-sm"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          selected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <User className="mr-2 h-4 w-4 text-ink/60 shrink-0" />
                      <span className="truncate">
                        {acct.name || 'Unnamed'}
                        {acct.role ? (
                          <span className="text-xs text-ink/60 ml-1">
                            ({getRoleLabel(acct.role)})
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {trimmedQuery.length >= 2 ? (
              <CommandGroup heading="Fallback">
                {queryLooksLikeEmail ? (
                  <CommandItem
                    value={`email:${trimmedQuery}`}
                    onSelect={() => {
                      onChange({ email: trimmedQuery.toLowerCase() });
                      setOpen(false);
                    }}
                    className="font-serif text-sm"
                  >
                    <Mail className="mr-2 h-4 w-4 text-ink/60 shrink-0" />
                    <span className="truncate">
                      Invite {trimmedQuery} by email
                    </span>
                  </CommandItem>
                ) : null}
                <CommandItem
                  value={`name:${trimmedQuery}`}
                  onSelect={() => {
                    onChange({ name: trimmedQuery });
                    setOpen(false);
                  }}
                  className="font-serif text-sm"
                >
                  <User className="mr-2 h-4 w-4 text-ink/60 shrink-0" />
                  <span className="truncate">
                    Off-platform buyer: &quot;{trimmedQuery}&quot;
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
