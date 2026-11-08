'use client';

import { useState, useTransition } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import type { ArtworkPublication } from '~/lib/valuation/provenance-value';
import { updateArtworkPublications } from '../_actions/update-artwork-publications';

const EMPTY: ArtworkPublication = { title: '', publication_name: '', url: '', date: '' };

/** Publications a work has appeared in; owners and their team can edit the list. */
export function ArtworkPublications({
  artworkId,
  publications,
  canEdit,
}: {
  artworkId: string;
  publications: ArtworkPublication[];
  canEdit: boolean;
}) {
  if (publications.length === 0 && !canEdit) return null;

  return (
    <div className="border-b border-wine/20 pb-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs sm:text-sm text-ink/60 font-serif">
          {publications.length > 1 ? `Publications (${publications.length})` : 'Publications'}
        </p>
        {canEdit && <EditPublicationsDialog artworkId={artworkId} publications={publications} />}
      </div>
      {publications.length === 0 ? (
        <p className="text-xs text-ink/50 font-serif italic">
          None listed. Adding a publication raises this work&apos;s Provenance Value by 5%.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {publications.map((p, i) => (
            <li key={`${p.title}-${i}`} className="text-sm sm:text-base font-serif text-ink break-words">
              {p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-wine underline-offset-4 hover:underline"
                >
                  {p.title}
                </a>
              ) : (
                p.title
              )}
              {(p.publication_name || p.date) && (
                <span className="block text-xs text-ink/60">
                  {[p.publication_name, p.date].filter(Boolean).join(' · ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditPublicationsDialog({
  artworkId,
  publications,
}: {
  artworkId: string;
  publications: ArtworkPublication[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ArtworkPublication[]>([]);
  const [isPending, startTransition] = useTransition();

  const onOpenChange = (next: boolean) => {
    if (next) setRows(publications.length ? publications.map((p) => ({ ...EMPTY, ...p })) : [{ ...EMPTY }]);
    setOpen(next);
  };

  const setField = (i: number, key: keyof ArtworkPublication, value: string) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));

  const save = () =>
    startTransition(async () => {
      const result = await updateArtworkPublications(artworkId, rows);
      if (!result.success) {
        toast.error(result.error ?? 'Could not save publications');
        return;
      }
      toast.success('Publications saved');
      setOpen(false);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-[11px] font-serif text-wine inline-flex items-center gap-1 hover:underline underline-offset-4"
        >
          {publications.length ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {publications.length ? 'Edit' : 'Add'}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogTitle className="font-serif">Publications</DialogTitle>
        <DialogDescription>
          Books, catalogues, magazines or articles this work has appeared in.
        </DialogDescription>
        <div className="space-y-4">
          {rows.map((row, i) => (
            <div key={i} className="rounded-md border border-wine/15 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`pub-title-${i}`} className="text-xs">Title</Label>
                  <Input
                    id={`pub-title-${i}`}
                    value={row.title}
                    placeholder="e.g. Review: Another Hit at FL!GHT"
                    onChange={(e) => setField(i, 'title', e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-5"
                  aria-label="Remove publication"
                  onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`pub-name-${i}`} className="text-xs">Publication</Label>
                  <Input
                    id={`pub-name-${i}`}
                    value={row.publication_name ?? ''}
                    placeholder="e.g. Artforum"
                    onChange={(e) => setField(i, 'publication_name', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`pub-date-${i}`} className="text-xs">Date</Label>
                  <Input
                    id={`pub-date-${i}`}
                    value={row.date ?? ''}
                    placeholder="e.g. 2026"
                    onChange={(e) => setField(i, 'date', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pub-url-${i}`} className="text-xs">Link (optional)</Label>
                <Input
                  id={`pub-url-${i}`}
                  value={row.url ?? ''}
                  placeholder="https://"
                  onChange={(e) => setField(i, 'url', e.target.value)}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows((r) => [...r, { ...EMPTY }])}
          >
            <Plus className="h-4 w-4 mr-1" /> Add publication
          </Button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
