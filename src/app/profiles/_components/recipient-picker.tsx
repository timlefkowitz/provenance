'use client';

import { useEffect, useState } from 'react';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Button } from '@kit/ui/button';
import { Search, X } from 'lucide-react';

export type PickedPerson = { id: string; name: string; picture_url: string | null };

export type RecipientValue =
  | { kind: 'person'; person: PickedPerson }
  | { kind: 'email'; email: string };

/**
 * Pick who a collection or an artist's certificates go to: someone already on Provenance
 * (searched by name), or an email address for someone who isn't yet.
 */
export function RecipientPicker({
  id,
  value,
  onChange,
  role = 'any',
  searchLabel,
  emailLabel,
}: {
  id: string;
  value: RecipientValue | null;
  onChange: (value: RecipientValue | null) => void;
  /** 'artist' searches artist accounts only */
  role?: 'artist' | 'any';
  searchLabel: string;
  emailLabel: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickedPerson[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search-people?role=${role}&q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        setResults(res.ok ? ((await res.json()) as PickedPerson[]) : []);
      } catch {
        // aborted or offline: keep whatever was there
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, role]);

  if (value?.kind === 'person') {
    return (
      <div className="space-y-2">
        <Label>{searchLabel}</Label>
        <div className="flex items-center justify-between rounded-md border border-wine/20 bg-parchment px-3 py-2">
          <span className="font-serif text-ink">
            {value.person.name}
            <span className="ml-2 text-xs text-ink/60">on Provenance</span>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} aria-label="Clear">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="font-serif text-xs text-ink/60">
          They get a notification and an email, and can accept or decline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${id}-search`}>{searchLabel}</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <Input
            id={`${id}-search`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            className="pl-9 font-serif"
            autoComplete="off"
          />
        </div>
        {query.trim().length >= 2 && (
          <ul className="max-h-48 overflow-y-auto rounded-md border border-wine/15 bg-parchment">
            {loading && results.length === 0 && (
              <li className="px-3 py-2 font-serif text-sm text-ink/60">Searching…</li>
            )}
            {!loading && results.length === 0 && (
              <li className="px-3 py-2 font-serif text-sm text-ink/60">
                No one found. Use their email below instead.
              </li>
            )}
            {results.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left font-serif text-sm text-ink hover:bg-wine/10"
                  onClick={() => {
                    onChange({ kind: 'person', person });
                    setQuery('');
                  }}
                >
                  {person.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-email`}>{emailLabel}</Label>
        <Input
          id={`${id}-email`}
          type="email"
          value={value?.kind === 'email' ? value.email : ''}
          onChange={(e) => onChange(e.target.value ? { kind: 'email', email: e.target.value } : null)}
          placeholder="name@example.com"
          className="font-serif"
        />
      </div>
    </div>
  );
}
