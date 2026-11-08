'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Check, Image as ImageIcon, Loader2, Pencil, ScanSearch, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { isMissingInfo } from '~/lib/artwork-lists';

import {
  type ListArtwork,
  clearList,
  deleteList,
  removeFromList,
  renameList,
} from '../../_actions/artwork-lists';
import { rememberLastList } from '../../_components/add-to-list-button';
import { FindByPhotoDialog } from '../../_components/find-by-photo-dialog';
import { PrintMenu } from '../../edit-provenance/_components/print-menu';

export function ListDetail({
  list,
  artworks,
  galleryName,
}: {
  list: { id: string; name: string };
  artworks: ListArtwork[];
  galleryName: string;
}) {
  const router = useRouter();
  const [rawSelected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  const [busy, setBusy] = useState<null | 'rename' | 'remove' | 'clear' | 'delete'>(null);

  // Scanning from this page should add to this list.
  useEffect(() => {
    rememberLastList({ id: list.id, name: list.name });
  }, [list.id, list.name]);

  // Ignore selections for works no longer on the list (after remove/refresh).
  const selected = useMemo(() => {
    const ids = new Set(artworks.map((a) => a.id));
    return new Set([...rawSelected].filter((id) => ids.has(id)));
  }, [rawSelected, artworks]);

  const missing = useMemo(() => artworks.filter(isMissingInfo), [artworks]);
  // With nothing selected, actions apply to the whole list.
  const targetIds = useMemo(
    () => (selected.size > 0 ? new Set(selected) : new Set(artworks.map((a) => a.id))),
    [selected, artworks],
  );
  const scopeLabel = selected.size > 0 ? `${selected.size} selected` : `all ${artworks.length}`;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const editHref = (ids: Iterable<string>) => `/artworks/edit-provenance?ids=${[...ids].join(',')}`;

  const saveName = async () => {
    if (name.trim() === list.name) return setRenaming(false);
    setBusy('rename');
    const result = await renameList(list.id, name);
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    setRenaming(false);
    router.refresh();
  };

  const removeSelected = async () => {
    if (selected.size === 0) return;
    setBusy('remove');
    const result = await removeFromList(list.id, [...selected]);
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    toast.success(`Removed ${selected.size} from ${list.name}`);
    setSelected(new Set());
    router.refresh();
  };

  const clearAll = async () => {
    if (!window.confirm(`Remove all ${artworks.length} works from “${list.name}”? The artworks themselves are not affected.`))
      return;
    setBusy('clear');
    const result = await clearList(list.id);
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    toast.success(`${list.name} cleared`);
    router.refresh();
  };

  const removeList = async () => {
    if (!window.confirm(`Delete the list “${list.name}”? The artworks themselves are not affected.`)) return;
    setBusy('delete');
    const result = await deleteList(list.id);
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    rememberLastList(null);
    router.push('/artworks/lists');
  };

  return (
    <div className="flex flex-col gap-6">
      <Link href="/artworks/lists" className="inline-flex w-fit items-center gap-1 font-serif text-xs text-ink/55 hover:text-wine">
        <ArrowLeft className="h-3.5 w-3.5" /> All lists
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {renaming ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void saveName();
              }}
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoFocus
                className="font-display text-xl"
              />
              <Button type="submit" size="sm" disabled={busy === 'rename'} className="bg-wine text-parchment hover:bg-wine/90">
                {busy === 'rename' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
            </form>
          ) : (
            <h1 className="flex items-center gap-2 font-display text-3xl text-wine">
              <span className="truncate">{list.name}</span>
              <button type="button" onClick={() => setRenaming(true)} aria-label="Rename list" className="text-ink/30 hover:text-wine">
                <Pencil className="h-4 w-4" />
              </button>
            </h1>
          )}
          <p className="mt-1 font-serif text-sm text-ink/60">
            {artworks.length} {artworks.length === 1 ? 'work' : 'works'}
            {missing.length > 0 && (
              <>
                {' · '}
                <Link href={editHref(missing.map((a) => a.id))} className="text-amber-800 underline-offset-2 hover:underline">
                  {missing.length} missing info
                </Link>
              </>
            )}
          </p>
        </div>

        <FindByPhotoDialog
          description={`Photograph a piece, then tap “+ ${list.name}” to add it.`}
          onClose={() => router.refresh()}
          trigger={
            <Button variant="outline" size="sm" className="font-serif gap-1.5 border-wine/25 w-fit">
              <ScanSearch className="h-3.5 w-3.5" />
              Scan to add
            </Button>
          }
        />
      </div>

      {artworks.length > 0 && (
        <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-y border-wine/10 bg-parchment/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-md sm:border">
          <span className="mr-auto font-serif text-xs text-ink/55">Acting on {scopeLabel}</span>
          <PrintMenu artworks={artworks} artworkData={{}} selectedArtworkIds={targetIds} galleryName={galleryName} />
          <Button asChild variant="outline" size="sm" className="font-serif border-wine/25">
            <Link href={editHref(targetIds)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit info
            </Link>
          </Button>
          {selected.size > 0 ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="font-serif text-ink/60">
                Deselect
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void removeSelected()}
                className="font-serif border-wine/25"
              >
                {busy === 'remove' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Remove from list
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => void clearAll()}
              className="font-serif border-wine/25"
            >
              {busy === 'clear' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Clear list
            </Button>
          )}
        </div>
      )}

      {artworks.length === 0 ? (
        <div className="rounded-md border border-dashed border-wine/20 p-8 text-center font-serif text-sm text-ink/55">
          This list is empty. Use <strong>Scan to add</strong> to photograph pieces, or add works from a certificate or
          your collection.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {artworks.map((artwork) => {
            const isSelected = selected.has(artwork.id);
            const needsInfo = isMissingInfo(artwork);
            return (
              <li
                key={artwork.id}
                className={cn(
                  'group relative overflow-hidden rounded-md border bg-white/70 transition-colors',
                  isSelected ? 'border-wine ring-2 ring-wine/40' : 'border-wine/15',
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(artwork.id)}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? 'Deselect' : 'Select'} ${artwork.title || 'Untitled'}`}
                  className="block aspect-square w-full bg-wine/5"
                >
                  {artwork.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={artwork.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-wine/25" />
                    </span>
                  )}
                  <span
                    className={cn(
                      'absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border bg-white/90',
                      isSelected ? 'border-wine bg-wine text-parchment' : 'border-ink/30',
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </span>
                  {needsInfo && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-50/95 px-2 py-0.5 font-serif text-[10px] text-amber-800">
                      <AlertCircle className="h-3 w-3" /> Missing info
                    </span>
                  )}
                </button>
                <Link href={`/artworks/${artwork.id}/certificate`} className="block px-2.5 py-2 hover:bg-wine/5">
                  <p className="truncate font-display text-sm text-ink">{artwork.title || 'Untitled'}</p>
                  <p className="truncate font-serif text-xs text-ink/50">
                    {artwork.artist_name || 'Unknown artist'}
                    {artwork.status === 'draft' ? ' · Draft' : ''}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void removeList()}
        className="mt-6 inline-flex w-fit items-center gap-1.5 font-serif text-xs text-ink/40 hover:text-red-700"
      >
        {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Delete list
      </button>
    </div>
  );
}
