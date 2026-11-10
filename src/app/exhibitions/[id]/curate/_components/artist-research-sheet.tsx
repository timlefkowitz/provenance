'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink, Loader2, Search, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';

import {
  getArtistResearchFindings,
  researchExhibitionArtist,
  reviewArtistResearchFindings,
  type StoredFinding,
} from '~/app/exhibitions/_actions/research-exhibition-artist';
import type { FindingKind } from '~/lib/artist-research/parse-artist-research';

const KIND_ORDER: FindingKind[] = ['bio_fact', 'exhibition', 'article', 'award', 'collection', 'sale'];
const KIND_LABELS: Record<FindingKind, string> = {
  bio_fact: 'Biography',
  exhibition: 'Exhibitions',
  article: 'Articles & reviews',
  award: 'Awards & residencies',
  collection: 'Collections',
  sale: 'Market record',
};
const FACT_LABELS: Record<string, string> = {
  summary: 'Bio',
  birth_year: 'Born',
  birth_place: 'Birthplace',
  nationality: 'Nationality',
  death_year: 'Died',
  education: 'Education',
  website: 'Website',
};

function describe(f: StoredFinding): { title: string; detail: string } {
  const p = f.payload as Record<string, string | boolean | undefined>;
  const join = (...xs: (string | boolean | undefined)[]) => xs.filter((x) => typeof x === 'string' && x).join(' · ');
  switch (f.kind) {
    case 'bio_fact':
      return { title: FACT_LABELS[p.field as string] ?? 'Fact', detail: String(p.value ?? '') };
    case 'article':
      return { title: String(p.title ?? ''), detail: join(p.publication_name, p.date) };
    case 'exhibition':
      return { title: String(p.title ?? ''), detail: join(p.solo === true ? 'Solo' : p.solo === false ? 'Group' : undefined, p.venue, p.city, p.year) };
    case 'sale':
      return { title: String(p.title ?? ''), detail: join(p.price_text, p.venue, p.year, p.lot ? `Lot ${p.lot}` : undefined) };
    case 'award':
      return { title: String(p.title ?? ''), detail: join(p.venue, p.year) };
    case 'collection':
      return { title: String(p.title ?? ''), detail: join(p.city, p.year) };
  }
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * "Find information" for one artist: searches the web for sourced facts,
 * shows earlier findings, and lets the curator accept (into the show copy)
 * or dismiss each one.
 */
export function ArtistResearchSheet({
  open,
  onOpenChange,
  exhibitionId,
  artistKey,
  artistName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exhibitionId: string;
  artistKey: string;
  artistName: string;
}) {
  const router = useRouter();
  const [findings, setFindings] = useState<StoredFinding[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = async () => {
    const res = await getArtistResearchFindings({ exhibitionId, artistKey });
    if (res.success) setFindings(res.findings);
    else setError(res.error);
  };

  useEffect(() => {
    if (!open) return;
    setFindings(null);
    setSelected(new Set());
    setError(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, artistKey]);

  const search = async () => {
    setSearching(true);
    setError(null);
    const res = await researchExhibitionArtist({ exhibitionId, artistKey });
    setSearching(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setFindings(res.findings);
    toast.success(res.added ? `Found ${res.added} new item${res.added === 1 ? '' : 's'}` : 'Nothing new found');
  };

  const review = (ids: string[], decision: 'accept' | 'dismiss') => {
    if (!ids.length) return;
    startTransition(async () => {
      const res = await reviewArtistResearchFindings({ exhibitionId, artistKey, findingIds: ids, decision });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setFindings((prev) =>
        (prev ?? []).map((f) => (ids.includes(f.id) ? { ...f, status: decision === 'accept' ? 'accepted' : 'dismissed' } : f)),
      );
      setSelected(new Set());
      if (decision === 'accept') {
        toast.success(res.changed.length ? 'Added to the artist details for this show' : 'Accepted');
      }
      router.refresh();
    });
  };

  const suggested = useMemo(() => (findings ?? []).filter((f) => f.status === 'suggested'), [findings]);
  const grouped = useMemo(() => {
    const visible = (findings ?? []).filter((f) => f.status !== 'dismissed');
    return KIND_ORDER.map((k) => ({ kind: k, items: visible.filter((f) => f.kind === k) })).filter((g) => g.items.length);
  }, [findings]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-display">Find information · {artistName}</SheetTitle>
          <SheetDescription className="font-serif">
            Searches the web for public, career-only facts: bio, past shows, press, awards, collections
            and auction results. Every item links to its source. Check each one is about this artist
            before accepting. Accepted facts fill this show&apos;s artist details; sales stay in the
            market record.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => void search()} disabled={searching} className="font-serif">
            {searching ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
            {findings && findings.length ? 'Search again' : 'Search the web'}
          </Button>
          {suggested.length > 0 && (
            <>
              <Button
                variant="outline"
                className="font-serif"
                disabled={pending || selected.size === 0}
                onClick={() => review([...selected], 'accept')}
              >
                <Check className="mr-1.5 h-4 w-4" /> Accept selected{selected.size ? ` (${selected.size})` : ''}
              </Button>
              <button
                type="button"
                className="font-serif text-xs text-ink/50 underline hover:text-ink"
                onClick={() =>
                  setSelected((prev) => (prev.size === suggested.length ? new Set() : new Set(suggested.map((f) => f.id))))
                }
              >
                {selected.size === suggested.length ? 'Select none' : 'Select all'}
              </button>
            </>
          )}
        </div>
        {searching && (
          <p className="mt-3 font-serif text-xs text-ink/50">Searching… this can take up to a minute.</p>
        )}
        {error && <p className="mt-3 font-serif text-sm text-red-700">{error}</p>}

        <div className="mt-6 space-y-6">
          {findings === null ? (
            <p className="flex items-center gap-2 font-serif text-sm text-ink/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : grouped.length === 0 ? (
            <p className="font-serif text-sm text-ink/50">
              No findings yet. Search the web to look for this artist&apos;s bio, shows, press and sales.
            </p>
          ) : (
            grouped.map((g) => (
              <section key={g.kind}>
                <p className="mb-2 font-serif text-[10px] uppercase tracking-widest text-ink/40">
                  {KIND_LABELS[g.kind]}
                </p>
                <ul className="divide-y divide-wine/10 rounded-lg border border-wine/12">
                  {g.items.map((f) => {
                    const d = describe(f);
                    const isSuggested = f.status === 'suggested';
                    return (
                      <li key={f.id} className="flex gap-3 p-3">
                        {isSuggested ? (
                          <Checkbox
                            checked={selected.has(f.id)}
                            onCheckedChange={() => toggle(f.id)}
                            aria-label={`Select ${d.title}`}
                            className="mt-0.5"
                          />
                        ) : (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-notify-success" aria-label="Accepted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-sm font-semibold text-ink">{d.title}</p>
                          {d.detail && (
                            <p className={`font-serif text-xs text-ink/60 ${f.kind === 'bio_fact' ? 'whitespace-pre-line' : ''}`}>
                              {d.detail}
                            </p>
                          )}
                          <a
                            href={f.source_url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="mt-1 inline-flex items-center gap-1 font-serif text-[11px] text-wine/70 hover:text-wine"
                          >
                            {f.source_title || host(f.source_url)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {isSuggested && (
                          <div className="flex shrink-0 flex-col gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 font-serif text-xs"
                              disabled={pending}
                              onClick={() => review([f.id], 'accept')}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 font-serif text-xs text-ink/50"
                              disabled={pending}
                              onClick={() => review([f.id], 'dismiss')}
                            >
                              <X className="mr-1 h-3 w-3" /> Dismiss
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {g.kind === 'sale' && (
                  <p className="mt-1 font-serif text-[11px] text-ink/40">
                    Sales are kept as provenance records for this artist and aren&apos;t added to bios or labels.
                  </p>
                )}
              </section>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
