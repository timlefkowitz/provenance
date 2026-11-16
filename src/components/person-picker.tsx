'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Mail, UserPlus, User, X } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@kit/ui/command';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import { getRoleLabel } from '~/lib/user-roles';
import {
  normalizePersonName,
  type PersonSearchResult,
  type PersonSearchRole,
  type PersonValue,
} from '~/lib/people/types';

export type { PersonValue } from '~/lib/people/types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PersonPickerProps {
  value: PersonValue | null;
  onChange: (value: PersonValue | null) => void;
  /** Which role to search. 'any' for owners and buyers. */
  role?: PersonSearchRole;
  /** Word used in the UI: "artist", "owner", "buyer"… */
  noun?: string;
  placeholder?: string;
  /** Offer "Add X as new" for people not on Provenance (default true). */
  allowNew?: boolean;
  /** Show an optional email field when adding someone new, to invite them. */
  askEmailForNew?: boolean;
  /** Let the signed-in user pick themselves (e.g. "I own this"). */
  includeSelf?: boolean;
  /** Also offer placeholder profiles nobody has claimed yet (default true). */
  includeUnclaimed?: boolean;
  /** Shown before the user types, e.g. artists this gallery already works with. */
  suggestions?: PersonSearchResult[];
  id?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Pick a person for a field like "Artist", "Owned by" or "Buyer": someone on
 * Provenance (including placeholder profiles nobody has claimed yet), or a new
 * person by name with an optional email invite. Search-first so the same
 * person isn't created twice.
 */
export function PersonPicker({
  value,
  onChange,
  role = 'any',
  noun = role === 'any' ? 'person' : role,
  placeholder,
  allowNew = true,
  askEmailForNew = false,
  includeSelf = false,
  includeUnclaimed = true,
  suggestions,
  id,
  disabled,
  className,
}: PersonPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [didYouMean, setDidYouMean] = useState<PersonSearchResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
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
        const params = new URLSearchParams({
          q: trimmed,
          role,
          include_unclaimed: includeUnclaimed ? '1' : '0',
          include_self: includeSelf ? '1' : '0',
        });
        const res = await fetch(`/api/search-people?${params}`, { signal: controller.signal });
        const data = res.ok ? ((await res.json()) as PersonSearchResult[]) : [];
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.error('[PersonPicker] search failed', err);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [trimmed, role, includeSelf, includeUnclaimed]);

  const shown = trimmed.length >= 2 ? results : (suggestions ?? []);
  const queryIsEmail = EMAIL_REGEX.test(trimmed);
  const exactMatch = useMemo(
    () => shown.find((r) => normalizePersonName(r.name) === normalizePersonName(trimmed)) ?? null,
    [shown, trimmed],
  );

  const pick = (person: PersonSearchResult) => {
    onChange({
      accountId: person.accountId,
      profileId: person.profileId,
      name: person.name,
      isNew: false,
    });
    setDidYouMean(null);
    setQuery('');
    setOpen(false);
  };

  const addNew = (name: string, email?: string) => {
    // Remember a close existing match so we can nudge before a duplicate is made.
    const close =
      shown.find((r) => normalizePersonName(r.name) === normalizePersonName(name)) ?? null;
    onChange({ name, email: email ?? null, isNew: true, accountId: null, profileId: null });
    setDidYouMean(close);
    setQuery('');
    setOpen(false);
  };

  const label = value?.name?.trim() || value?.email?.trim() || null;
  const isExisting = !!value && !value.isNew && !!(value.accountId || value.profileId);

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={`Select ${noun}`}
            disabled={disabled}
            className={cn(
              'font-serif text-sm min-h-11 h-auto w-full max-w-full sm:h-9 sm:min-h-0 flex items-center justify-between gap-2 rounded-md border border-wine/20 bg-background px-3 py-2 text-left',
              'hover:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/30 focus:ring-offset-2 focus:ring-offset-parchment',
              'disabled:cursor-not-allowed disabled:opacity-60',
              !label && 'text-ink/50',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              {label ? (
                isExisting ? (
                  <Check className="h-4 w-4 shrink-0 text-wine" aria-hidden />
                ) : (
                  <UserPlus className="h-4 w-4 shrink-0 text-ink/60" aria-hidden />
                )
              ) : null}
              <span className="truncate">
                {label ?? placeholder ?? `Search for the ${noun}…`}
              </span>
              {label ? (
                <span className="shrink-0 text-xs text-ink/60">
                  {isExisting ? 'on Provenance' : 'new'}
                </span>
              ) : null}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(calc(100vw-2rem),360px)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={`Type the ${noun}'s name…`}
              className="font-serif text-sm"
            />
            <CommandList>
              <CommandEmpty className="font-serif text-sm py-3 text-center text-ink/60">
                {loading ? 'Searching…' : trimmed.length < 2 ? 'Type at least 2 letters' : 'No one found'}
              </CommandEmpty>

              {shown.length > 0 ? (
                <CommandGroup heading={trimmed.length >= 2 ? 'On Provenance' : 'Suggestions'}>
                  {shown.map((person) => {
                    const selected =
                      !!value &&
                      ((person.accountId && value.accountId === person.accountId) ||
                        (person.profileId && value.profileId === person.profileId));
                    return (
                      <CommandItem
                        key={person.key}
                        value={person.key}
                        onSelect={() => pick(person)}
                        className="font-serif text-sm"
                      >
                        <Avatar person={person} />
                        <span className="ml-2 flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{person.name}</span>
                          <span className="truncate text-xs text-ink/60">
                            {[
                              person.role ? getRoleLabel(person.role) : null,
                              person.location,
                              person.claimed ? null : 'Not joined yet',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        {selected ? <Check className="ml-2 h-4 w-4 shrink-0" /> : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}

              {allowNew && trimmed.length >= 2 && !exactMatch ? (
                <CommandGroup heading="Not on Provenance">
                  {queryIsEmail ? (
                    <CommandItem
                      value={`__email__:${trimmed}`}
                      onSelect={() => addNew('', trimmed.toLowerCase())}
                      className="font-serif text-sm"
                    >
                      <Mail className="mr-2 h-4 w-4 shrink-0 text-ink/60" />
                      <span className="truncate">Invite {trimmed}</span>
                    </CommandItem>
                  ) : (
                    <CommandItem
                      value={`__new__:${trimmed}`}
                      onSelect={() => addNew(trimmed)}
                      className="font-serif text-sm"
                    >
                      <UserPlus className="mr-2 h-4 w-4 shrink-0 text-ink/60" />
                      <span className="truncate">
                        Add &ldquo;{trimmed}&rdquo; as a new {noun}
                      </span>
                    </CommandItem>
                  )}
                </CommandGroup>
              ) : null}

              {value ? (
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onChange(null);
                      setDidYouMean(null);
                      setQuery('');
                      setOpen(false);
                    }}
                    className="font-serif text-sm text-ink/70"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Clear
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value?.isNew && didYouMean ? (
        <p className="font-serif text-xs text-ink/70">
          {didYouMean.name} is already on Provenance.{' '}
          <button
            type="button"
            className="underline text-wine"
            onClick={() => pick(didYouMean)}
          >
            Use them instead
          </button>
        </p>
      ) : null}

      {value?.isNew ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            aria-label={`${noun} name`}
            placeholder={`${capitalize(noun)}'s name`}
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className="font-serif"
            disabled={disabled}
          />
          {askEmailForNew || value.email ? (
            <Input
              type="email"
              aria-label={`${noun} email (optional)`}
              placeholder="Email to invite them (optional)"
              value={value.email ?? ''}
              onChange={(e) => onChange({ ...value, email: e.target.value || null })}
              className="font-serif"
              disabled={disabled}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ person }: { person: PersonSearchResult }) {
  if (person.picture_url) {
    // eslint-disable-next-line @next/next/no-img-element -- small remote avatar
    return (
      <img
        src={person.picture_url}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wine/10">
      <User className="h-3.5 w-3.5 text-ink/60" />
    </span>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert a stored artwork's artist columns back into a picker value. */
export function personValueFromColumns(
  name: string | null | undefined,
  accountId?: string | null,
  profileId?: string | null,
): PersonValue | null {
  const n = name?.trim();
  if (!n && !accountId && !profileId) return null;
  return {
    name: n ?? '',
    accountId: accountId ?? null,
    profileId: profileId ?? null,
    isNew: !accountId && !profileId,
  };
}
