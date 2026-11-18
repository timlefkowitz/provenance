'use client';

import { useState, useTransition } from 'react';
import { Link2, Plus, X } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { EditorialDialogContent } from '~/components/editorial-dialog';
import {
  COLLECTION_LINK_LABEL_MAX,
  COLLECTION_LINK_URL_MAX,
  MAX_COLLECTION_LINKS,
  normalizeLinkUrl,
  suggestLinkLabel,
  type CollectionLink,
} from '~/lib/collection-links';
import { getCollectionLinks, saveCollectionLinks } from '../_actions/collection-links';

const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * Collection Management → Links: Instagram, website, shop… saved on the
 * account and offered as extra QR codes when printing wall labels.
 */
export function CollectionLinksDialog() {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<CollectionLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setLoading(true);
    getCollectionLinks()
      .then((saved) => setLinks(saved.length > 0 ? saved : [{ id: newId(), label: 'Instagram', url: '' }]))
      .catch((err) => {
        console.error('[CollectionLinks] Load failed', err);
        toast.error('Could not load your links.');
      })
      .finally(() => setLoading(false));
  };

  const update = (id: string, patch: Partial<CollectionLink>) =>
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const filled = links.filter((l) => l.url.trim());
  const invalid = filled.filter((l) => !normalizeLinkUrl(l.url, l.label));

  const handleSave = () => {
    if (invalid.length > 0) {
      toast.error(`Check the link for “${invalid[0]!.label || invalid[0]!.url}”.`);
      return;
    }
    const toSave = filled.map((l) => {
      const url = normalizeLinkUrl(l.url, l.label)!;
      return { id: l.id, url, label: l.label.trim() || suggestLinkLabel(url) };
    });
    startTransition(async () => {
      const res = await saveCollectionLinks(toSave);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(res.links.length ? 'Links saved. Add them as QR codes when printing wall labels.' : 'Links cleared.');
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 px-4 font-serif text-sm border-wine/30 bg-parchment/40 text-ink hover:bg-wine/10 hover:text-ink"
        >
          <Link2 className="h-4 w-4 mr-1.5" aria-hidden />
          Links
        </Button>
      </DialogTrigger>
      <EditorialDialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Links</DialogTitle>
          <DialogDescription>
            Your Instagram, website, shop or video. When you print wall labels you can add any of these as an extra QR
            code.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-ink/50">Loading…</p>
        ) : (
          <div className="space-y-3">
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
                    className="w-32 shrink-0"
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
                    />
                    {bad && <p className="mt-1 text-[11px] text-red-700">Not a link we can use.</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLinks((prev) => prev.filter((x) => x.id !== l.id))}
                    className="mt-2 shrink-0 rounded p-1 text-ink/40 hover:text-ink"
                    aria-label={`Remove ${l.label || 'link'}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            {links.length < MAX_COLLECTION_LINKS && (
              <button
                type="button"
                onClick={() => setLinks((prev) => [...prev, { id: newId(), label: '', url: '' }])}
                className="inline-flex items-center gap-1 text-xs font-serif text-wine underline hover:text-wine/80"
              >
                <Plus className="h-3.5 w-3.5" />
                Add a link
              </button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={loading || pending}>
            {pending ? 'Saving…' : 'Save links'}
          </Button>
        </DialogFooter>
      </EditorialDialogContent>
    </Dialog>
  );
}
