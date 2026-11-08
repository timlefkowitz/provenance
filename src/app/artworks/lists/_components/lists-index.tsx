'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import { normalizeListName } from '~/lib/artwork-lists';

import { type ArtworkList, createList } from '../../_actions/artwork-lists';

const SUGGESTIONS = ['To print', 'Needs info'];

export function ListsIndex({ initialLists }: { initialLists: ArtworkList[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const create = async (raw: string) => {
    const cleaned = normalizeListName(raw);
    if (!cleaned || creating) return;
    setCreating(true);
    try {
      const result = await createList(cleaned);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setName('');
      router.push(`/artworks/lists/${result.data.id}`);
    } finally {
      setCreating(false);
    }
  };

  const existing = new Set(initialLists.map((l) => l.name.toLowerCase()));
  const suggestions = SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase()));

  return (
    <div className="mt-8 flex flex-col gap-6">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void create(name);
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New list name, e.g. To print"
          maxLength={80}
          className="font-serif"
        />
        <Button
          type="submit"
          disabled={!name.trim() || creating}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif gap-1.5"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create
        </Button>
      </form>

      {suggestions.length > 0 && (
        <div className="-mt-3 flex flex-wrap items-center gap-2 text-xs font-serif text-ink/50">
          Quick start:
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={creating}
              onClick={() => void create(s)}
              className="rounded-full border border-wine/20 px-2.5 py-1 text-ink/70 hover:bg-wine/5"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {initialLists.length === 0 ? (
        <p className="rounded-md border border-dashed border-wine/20 p-6 text-center font-serif text-sm text-ink/55">
          No lists yet.
        </p>
      ) : (
        <ul className="divide-y divide-wine/10 rounded-md border border-wine/15 bg-white/60">
          {initialLists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/artworks/lists/${list.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-wine/5"
              >
                <span className="min-w-0 flex-1 truncate font-display text-ink">{list.name}</span>
                <span className="font-serif text-xs text-ink/50">
                  {list.item_count} {list.item_count === 1 ? 'work' : 'works'}
                </span>
                <ChevronRight className="h-4 w-4 text-ink/30" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
