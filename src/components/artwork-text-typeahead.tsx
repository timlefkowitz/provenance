'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';

export type ArtworkTextField =
  | 'medium'
  | 'production_location'
  | 'owned_by'
  | 'sold_by'
  | 'former_owners';

export function ArtworkTextTypeahead({
  id,
  value,
  onChange,
  userId,
  field,
  placeholder,
  minChars = 2,
  kind = 'input',
  rows = 4,
  className,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  userId: string | null | undefined;
  field: ArtworkTextField;
  placeholder?: string;
  minChars?: number;
  kind?: 'input' | 'textarea';
  rows?: number;
  className?: string;
  disabled?: boolean;
}) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedValue(value), 250);
    return () => window.clearTimeout(t);
  }, [value]);

  const trimmedQuery = useMemo(() => debouncedValue.trim(), [debouncedValue]);

  useEffect(() => {
    if (!userId || disabled) {
      setOpen(false);
      setSuggestions([]);
      return;
    }

    if (trimmedQuery.length < minChars) {
      setOpen(false);
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setOpen(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch(
          `/api/search-artwork-text?userId=${encodeURIComponent(
            userId,
          )}&field=${encodeURIComponent(field)}&q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          setSuggestions([]);
          return;
        }

        const data = (await res.json()) as { suggestions?: string[] } | string[];
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.suggestions)
            ? data.suggestions
            : [];

        // Keep UI stable + avoid overly long strings in dropdown.
        const safe = list
          .filter((s) => typeof s === 'string')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 10);

        setSuggestions(safe);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('[ArtworkTextTypeahead] suggestion fetch failed', err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [trimmedQuery, userId, disabled, field, minChars]);

  const handleSelect = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="relative">
      {kind === 'textarea' ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={className}
          autoComplete="off"
          autoCorrect="off"
          disabled={disabled}
          onFocus={() => {
            if (!disabled && trimmedQuery.length >= minChars) setOpen(true);
          }}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
          autoCorrect="off"
          disabled={disabled}
          onFocus={() => {
            if (!disabled && trimmedQuery.length >= minChars) setOpen(true);
          }}
        />
      )}

      {open && trimmedQuery.length >= minChars && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-wine/20 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-sm text-ink/60 font-serif">Searching...</div>
          ) : suggestions.length > 0 ? (
            <div className="py-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent the input/textarea from losing focus before click.
                    e.preventDefault();
                    handleSelect(s);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-wine/10 transition-colors font-serif text-sm"
                  title={s}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-sm text-ink/60 font-serif">
              No suggestions
            </div>
          )}
        </div>
      )}
    </div>
  );
}

