'use client';

import { useState, useTransition, useMemo } from 'react';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { toast } from '@kit/ui/sonner';
import { Search, Loader2 } from 'lucide-react';
import { findPressArticles } from '../_actions/find-press-articles';
import type { NewsPublication } from '../_actions/get-user-profiles';
import {
  mergeNewsPublicationsDeduped,
  normalizeNewsPublicationUrl,
} from '~/lib/news-publications';

type Props = {
  profileId: string;
  existingPublications: NewsPublication[];
  onPublicationsChange: (next: NewsPublication[]) => void;
};

export function PressArticleDiscovery({
  profileId,
  existingPublications,
  onPublicationsChange,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<NewsPublication[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const existingUrls = useMemo(() => {
    const s = new Set<string>();
    for (const p of existingPublications) {
      const k = normalizeNewsPublicationUrl(p.url);
      if (k) s.add(k);
    }
    return s;
  }, [existingPublications]);

  const handleFind = () => {
    startTransition(async () => {
      const { articles, error } = await findPressArticles(profileId);
      if (error) {
        toast.error(error);
        setSuggestions([]);
        setSelected(new Set());
        return;
      }
      setSuggestions(articles);
      setSelected(new Set(articles.map((_, i) => i)));
      if (articles.length === 0) {
        toast.message('No articles found', {
          description: 'Try refining the profile name or location, then search again.',
        });
      } else {
        toast.success(`Found ${articles.length} suggestion${articles.length === 1 ? '' : 's'}`);
      }
    });
  };

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleAddSelected = () => {
    const toAdd = suggestions.filter((_, i) => selected.has(i));
    if (toAdd.length === 0) {
      toast.error('Select at least one article');
      return;
    }
    const merged = mergeNewsPublicationsDeduped(existingPublications, toAdd);
    onPublicationsChange(merged);
    toast.success(
      `Added ${toAdd.length} article${toAdd.length === 1 ? '' : 's'} to your list — save the profile to publish.`,
    );
    setSuggestions([]);
    setSelected(new Set());
  };

  return (
    <div className="rounded-md border border-wine/20 bg-parchment/30 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="font-serif font-medium text-wine">Find articles online</p>
          <p className="text-sm text-ink/60 font-serif mt-1">
            Search the web using your profile name and location, then add press links to the list below. Requires{' '}
            <code className="text-xs bg-parchment px-1 rounded">TAVILY_API_KEY</code> and{' '}
            <code className="text-xs bg-parchment px-1 rounded">OPENAI_API_KEY</code>.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="font-serif border-wine/30 shrink-0"
          onClick={handleFind}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching…
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Find articles
            </>
          )}
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-serif text-ink/80">Suggestions — select items to add to News &amp; Publications</p>
          <ul className="space-y-2 max-h-72 overflow-y-auto border border-wine/15 rounded-md p-2 bg-parchment/50">
            {suggestions.map((s, i) => {
              const key = normalizeNewsPublicationUrl(s.url);
              const already = Boolean(key && existingUrls.has(key));
              return (
                <li
                  key={`${s.url}-${i}`}
                  className="flex gap-3 items-start p-2 rounded hover:bg-wine/5"
                >
                  <Checkbox
                    id={`press-sug-${i}`}
                    checked={selected.has(i)}
                    onCheckedChange={() => toggle(i)}
                    disabled={already}
                    className="mt-1"
                  />
                  <label htmlFor={`press-sug-${i}`} className="flex-1 cursor-pointer min-w-0">
                    <span className="font-serif text-sm font-medium text-ink block">{s.title}</span>
                    {s.publication_name && (
                      <span className="text-xs text-ink/60 font-serif">{s.publication_name}</span>
                    )}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-wine hover:underline break-all block mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {s.url}
                    </a>
                    {already && (
                      <span className="text-xs text-ink/50 font-serif mt-1 block">Already on your list</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            onClick={handleAddSelected}
            disabled={selected.size === 0}
          >
            Add selected to list
          </Button>
        </div>
      )}
    </div>
  );
}
