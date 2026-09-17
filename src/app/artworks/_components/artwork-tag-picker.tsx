'use client';

import { useEffect, useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { createTag, listMyTags, type Tag } from '../_actions/tags';

type Props = {
  selectedTags: Tag[];
  onChange: (tags: Tag[]) => void;
};

export function ArtworkTagPicker({ selectedTags, onChange }: Props) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [loading, startLoading] = useTransition();
  const [creating, startCreating] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      setAllTags(await listMyTags());
    });
  }, []);

  const selectedIds = new Set(selectedTags.map((t) => t.id));
  const trimmedQuery = query.trim();
  const suggestions = allTags.filter(
    (t) => !selectedIds.has(t.id) && (trimmedQuery === '' || t.name.toLowerCase().includes(trimmedQuery.toLowerCase())),
  );
  const exactMatch = allTags.some((t) => t.name.toLowerCase() === trimmedQuery.toLowerCase());

  function addTag(tag: Tag) {
    onChange([...selectedTags, tag]);
    setQuery('');
  }

  function removeTag(id: string) {
    onChange(selectedTags.filter((t) => t.id !== id));
  }

  function handleCreate() {
    if (!trimmedQuery || creating) return;
    startCreating(async () => {
      const result = await createTag(trimmedQuery);
      if (result.success && result.tag) {
        const newTag = result.tag;
        setAllTags((prev) => (prev.some((t) => t.id === newTag.id) ? prev : [...prev, newTag]));
        addTag(newTag);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label className="font-serif text-sm text-ink/80">Tags</Label>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full border border-wine/20 bg-wine/5 px-2.5 py-1 text-xs font-serif text-ink"
            >
              {tag.name}
              <button type="button" onClick={() => removeTag(tag.id)} aria-label={`Remove ${tag.name}`}>
                <X className="w-3 h-3 text-ink/50 hover:text-ink" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const topMatch = suggestions[0];
            if (topMatch && topMatch.name.toLowerCase() === trimmedQuery.toLowerCase()) {
              addTag(topMatch);
            } else if (trimmedQuery) {
              handleCreate();
            }
          }}
          placeholder={loading ? 'Loading tags…' : 'e.g. Street Photography'}
          className="font-serif text-sm"
        />

        {trimmedQuery && (suggestions.length > 0 || !exactMatch) && (
          <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-wine/15 bg-white shadow-sm">
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => addTag(tag)}
                className="block w-full px-3 py-1.5 text-left text-xs font-serif text-ink hover:bg-wine/5"
              >
                {tag.name}
              </button>
            ))}
            {!exactMatch && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="block w-full px-3 py-1.5 text-left text-xs font-serif text-wine hover:bg-wine/5 disabled:opacity-50"
              >
                {creating ? 'Creating…' : `Create "${trimmedQuery}"`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
