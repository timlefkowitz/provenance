'use client';

import { Plus, X } from 'lucide-react';
import { Input } from '@kit/ui/input';
import {
  COLLECTION_LINK_LABEL_MAX,
  COLLECTION_LINK_URL_MAX,
  MAX_ARTWORK_LINKS,
  normalizeLinkUrl,
  type CollectionLink,
} from '~/lib/collection-links';

const newId = () => Math.random().toString(36).slice(2, 10);

/** One work's links (Instagram post, video, shop page); each can print as a wall-label QR code. */
export function ArtworkLinksField({
  links,
  onChange,
}: {
  links: CollectionLink[];
  onChange: (next: CollectionLink[]) => void;
}) {
  const update = (id: string, patch: Partial<CollectionLink>) =>
    onChange(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-2">
      {links.map((l) => {
        const bad = l.url.trim() !== '' && !normalizeLinkUrl(l.url, l.label);
        return (
          <div key={l.id} className="flex items-start gap-2">
            <Input
              value={l.label}
              maxLength={COLLECTION_LINK_LABEL_MAX}
              onChange={(e) => update(l.id, { label: e.target.value })}
              placeholder="Label"
              aria-label="Link label"
              className="font-serif text-sm h-9 border-wine/20 w-28 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <Input
                value={l.url}
                maxLength={COLLECTION_LINK_URL_MAX}
                onChange={(e) => update(l.id, { url: e.target.value })}
                placeholder="@handle or https://…"
                aria-label="Link"
                aria-invalid={bad || undefined}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                className="font-serif text-sm h-9 border-wine/20"
              />
              {bad && <p className="mt-1 text-[11px] text-red-700">Not a link we can use.</p>}
            </div>
            <button
              type="button"
              onClick={() => onChange(links.filter((x) => x.id !== l.id))}
              className="mt-2 shrink-0 rounded p-0.5 text-ink/40 hover:text-ink"
              aria-label={`Remove ${l.label || 'link'}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      {links.length < MAX_ARTWORK_LINKS && (
        <button
          type="button"
          onClick={() => onChange([...links, { id: newId(), label: '', url: '' }])}
          className="inline-flex items-center gap-1 text-xs font-serif text-wine underline hover:text-wine/80"
        >
          <Plus className="h-3.5 w-3.5" />
          Add a link
        </button>
      )}
      <p className="text-[11px] font-serif text-ink/45">Prints as a QR code on this work&apos;s wall label.</p>
    </div>
  );
}

/** Cleaned links ready to save, or null when one is not a usable link. */
export function cleanArtworkLinks(links: CollectionLink[]): CollectionLink[] | null {
  const out: CollectionLink[] = [];
  for (const l of links) {
    if (!l.url.trim()) continue;
    const url = normalizeLinkUrl(l.url, l.label);
    if (!url) return null;
    out.push({ id: l.id, label: l.label.trim(), url });
  }
  return out;
}
