'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Textarea } from '@kit/ui/textarea';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import {
  CV_ENTRY_TYPE_LABELS,
  FIELD_LABELS,
  suggestionFieldKeys,
  type ScalarField,
} from '~/lib/artist-details/fields';
import {
  respondToProfileSuggestion,
  type PendingProfileSuggestion,
} from '../_actions/profile-suggestions';

const LONG_TEXT = new Set<ScalarField>(['bio', 'artist_statement']);

/** One curator's suggested changes: current vs suggested, pick what to keep. */
export function ProfileSuggestionReview({ suggestion }: { suggestion: PendingProfileSuggestion }) {
  const router = useRouter();
  const keys = suggestionFieldKeys(suggestion.fields);
  const [accepted, setAccepted] = useState<Set<string>>(new Set(keys));
  const [overrides, setOverrides] = useState<Partial<Record<ScalarField, string>>>({});
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const toggle = (k: string) =>
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const respond = (decision: 'accept' | 'decline') =>
    startTransition(async () => {
      const res = await respondToProfileSuggestion({
        suggestionId: suggestion.id,
        decision,
        accepted: [...accepted],
        overrides,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(decision === 'accept' ? 'Your profile is updated' : 'Declined');
      router.refresh();
    });

  return (
    <section className="rounded-2xl border border-wine/15 bg-parchment/40 p-5">
      <header className="mb-4">
        <p className="font-serif text-[10px] uppercase tracking-widest text-wine/60">
          {suggestion.exhibitionTitle ? `For “${suggestion.exhibitionTitle}”` : 'Suggested update'}
        </p>
        <h2 className="font-display text-xl font-semibold text-ink">
          {suggestion.requestedByName ?? 'A curator'} suggested updates to {suggestion.profileName}
        </h2>
        {suggestion.message && <p className="mt-1 font-serif text-sm text-ink/70">“{suggestion.message}”</p>}
      </header>

      <ul className="space-y-4">
        {keys.map((k) => {
          if (k === 'cv_entries_add') {
            const items = suggestion.fields.cv_entries_add ?? [];
            return (
              <li key={k} className="flex gap-3">
                <Checkbox checked={accepted.has(k)} onCheckedChange={() => toggle(k)} aria-label="Add CV entries" className="mt-1" />
                <div className="flex-1">
                  <p className="font-serif text-sm font-semibold">Add to your CV ({items.length})</p>
                  <ul className="mt-1 space-y-0.5 font-serif text-sm text-ink/70">
                    {items.map((e, i) => (
                      <li key={i}>
                        <span className="text-ink/40">{CV_ENTRY_TYPE_LABELS[e.type]}: </span>
                        {[e.title, e.venue, e.city, e.year].filter(Boolean).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          }
          if (k === 'press_add') {
            const items = suggestion.fields.press_add ?? [];
            return (
              <li key={k} className="flex gap-3">
                <Checkbox checked={accepted.has(k)} onCheckedChange={() => toggle(k)} aria-label="Add press" className="mt-1" />
                <div className="flex-1">
                  <p className="font-serif text-sm font-semibold">Add to your press ({items.length})</p>
                  <ul className="mt-1 space-y-0.5 font-serif text-sm">
                    {items.map((p, i) => (
                      <li key={i}>
                        <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="text-wine hover:underline">
                          {p.title}
                        </a>
                        {p.publication_name && <span className="text-ink/50"> · {p.publication_name}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          }
          const field = k as ScalarField;
          const suggested = String(suggestion.fields[field] ?? '');
          const current = suggestion.current[field];
          const value = overrides[field] ?? suggested;
          const isEditing = editing.has(field);
          return (
            <li key={k} className="flex gap-3">
              <Checkbox checked={accepted.has(k)} onCheckedChange={() => toggle(k)} aria-label={FIELD_LABELS[field]} className="mt-1" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-serif text-sm font-semibold">{FIELD_LABELS[field]}</p>
                  {field !== 'picture_url' && (
                    <button
                      type="button"
                      className="font-serif text-[11px] text-ink/50 underline hover:text-ink"
                      onClick={() =>
                        setEditing((prev) => {
                          const next = new Set(prev);
                          if (next.has(field)) next.delete(field);
                          else next.add(field);
                          return next;
                        })
                      }
                    >
                      {isEditing ? 'Done' : 'Edit'}
                    </button>
                  )}
                </div>
                {field === 'picture_url' ? (
                  <div className="flex items-center gap-4">
                    {current ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={String(current)} alt="Current" className="h-16 w-16 rounded-full object-cover opacity-60" />
                    ) : (
                      <span className="font-serif text-xs text-ink/40">No photo now</span>
                    )}
                    <span className="text-ink/30">→</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={suggested} alt="Suggested" className="h-16 w-16 rounded-full object-cover" />
                  </div>
                ) : (
                  <>
                    {current !== null && current !== undefined && String(current) !== '' && (
                      <p className="font-serif text-xs text-ink/45 line-through decoration-ink/20 whitespace-pre-line line-clamp-4">
                        {String(current)}
                      </p>
                    )}
                    {isEditing ? (
                      LONG_TEXT.has(field) ? (
                        <Textarea
                          rows={5}
                          value={value}
                          onChange={(e) => setOverrides((o) => ({ ...o, [field]: e.target.value }))}
                          className="font-serif text-sm"
                        />
                      ) : (
                        <Input
                          value={value}
                          onChange={(e) => setOverrides((o) => ({ ...o, [field]: e.target.value }))}
                          className="font-serif text-sm"
                        />
                      )
                    ) : (
                      <p className="font-serif text-sm text-ink whitespace-pre-line">{value}</p>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {suggestion.sources.length > 0 && (
        <div className="mt-5 border-t border-wine/10 pt-3">
          <p className="mb-1 font-serif text-[10px] uppercase tracking-widest text-ink/40">Sources the curator used</p>
          <ul className="space-y-0.5">
            {suggestion.sources.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 font-serif text-xs text-wine/80 hover:text-wine"
                >
                  {s.title || s.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="mt-5 flex flex-wrap gap-2">
        <Button className="font-serif" disabled={pending || accepted.size === 0} onClick={() => respond('accept')}>
          {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {accepted.size === keys.length ? 'Accept all' : `Accept selected (${accepted.size})`}
        </Button>
        <Button variant="ghost" className="font-serif" disabled={pending} onClick={() => respond('decline')}>
          Decline
        </Button>
      </footer>
    </section>
  );
}
