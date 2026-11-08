'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, ListPlus, Loader2, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { LAST_LIST_STORAGE_KEY, normalizeListName } from '~/lib/artwork-lists';

import {
  type ArtworkList,
  addToList,
  createList,
  getListIdsForArtwork,
  listMyLists,
  removeFromList,
} from '../_actions/artwork-lists';

type LastList = { id: string; name: string };

function readLastList(): LastList | null {
  try {
    const raw = window.localStorage.getItem(LAST_LIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastList;
    return parsed?.id && parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

/** Make `list` the target of the quick-add button (e.g. when viewing that list). */
export function rememberLastList(list: LastList | null) {
  writeLastList(list);
}

function writeLastList(list: LastList | null) {
  try {
    if (list) window.localStorage.setItem(LAST_LIST_STORAGE_KEY, JSON.stringify(list));
    else window.localStorage.removeItem(LAST_LIST_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode etc.) — quick-add just won't remember.
  }
}

/**
 * Add one or more of your artworks to a named list (e.g. a "To print" wall-label queue).
 *
 * Renders a one-tap "+ <last list>" button once a list has been used, plus a "Lists"
 * popover to pick, toggle or create lists. With a single artwork the popover shows
 * which lists already contain it and toggles membership; with several it only adds.
 */
export function AddToListButton({
  artworkIds,
  size = 'sm',
  className,
  showQuickAdd = true,
}: {
  artworkIds: string[];
  size?: 'sm' | 'default';
  className?: string;
  showQuickAdd?: boolean;
}) {
  const single = artworkIds.length === 1 ? artworkIds[0] : null;
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ArtworkList[] | null>(null);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [lastList, setLastList] = useState<LastList | null>(null);
  const [newName, setNewName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setLastList(readLastList());
  }, []);

  const load = useCallback(() => {
    startTransition(async () => {
      const [mine, members] = await Promise.all([
        listMyLists(),
        single ? getListIdsForArtwork(single) : Promise.resolve([] as string[]),
      ]);
      setLists(mine);
      setMemberIds(new Set(members));
      // Forget a remembered list that was deleted elsewhere.
      const remembered = readLastList();
      if (remembered && !mine.some((l) => l.id === remembered.id)) {
        writeLastList(null);
        setLastList(null);
      }
    });
  }, [single]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const remember = (list: LastList) => {
    writeLastList(list);
    setLastList(list);
  };

  const add = async (list: LastList) => {
    setBusyId(list.id);
    try {
      const result = await addToList(list.id, artworkIds);
      if (!result.success) {
        toast.error(result.error);
        // A stale remembered list (deleted) — drop it so the quick button disappears.
        if (lastList?.id === list.id) {
          writeLastList(null);
          setLastList(null);
        }
        return;
      }
      remember(list);
      setMemberIds((prev) => new Set(prev).add(list.id));
      setLists((prev) =>
        prev?.map((l) => (l.id === list.id && !memberIds.has(l.id) ? { ...l, item_count: l.item_count + result.data.added } : l)) ??
        prev,
      );
      toast.success(
        result.data.added === 1 ? `Added to ${list.name}` : `Added ${result.data.added} works to ${list.name}`,
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (list: ArtworkList) => {
    setBusyId(list.id);
    try {
      const result = await removeFromList(list.id, artworkIds);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(list.id);
        return next;
      });
      setLists((prev) => prev?.map((l) => (l.id === list.id ? { ...l, item_count: Math.max(0, l.item_count - 1) } : l)) ?? prev);
      toast.success(`Removed from ${list.name}`);
    } finally {
      setBusyId(null);
    }
  };

  const create = async () => {
    const name = normalizeListName(newName);
    if (!name) return;
    setBusyId('__new__');
    try {
      const result = await createList(name);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setNewName('');
      setLists((prev) => (prev?.some((l) => l.id === result.data.id) ? prev : [result.data, ...(prev ?? [])]));
      await add({ id: result.data.id, name: result.data.name });
    } finally {
      setBusyId(null);
    }
  };

  if (artworkIds.length === 0) return null;

  const quickInList = lastList ? single !== null && memberIds.has(lastList.id) : false;

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      {showQuickAdd && lastList && (
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={busyId !== null || quickInList}
          onClick={() => void add(lastList)}
          className="font-serif gap-1 border-wine/25 max-w-[11rem]"
          title={`Add to ${lastList.name}`}
        >
          {busyId === lastList.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : quickInList ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          <span className="truncate">{lastList.name}</span>
        </Button>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size={size} className="font-serif gap-1 border-wine/25">
            <ListPlus className="h-3.5 w-3.5" />
            {lastList && showQuickAdd ? 'Lists' : 'Add to list'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(calc(100vw-2rem),280px)] p-0" align="end">
          <div className="border-b border-wine/10 px-3 py-2">
            <p className="font-display text-sm text-wine">
              {artworkIds.length === 1 ? 'Add to list' : `Add ${artworkIds.length} works to list`}
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {lists === null || (pending && lists.length === 0) ? (
              <p className="flex items-center gap-1.5 px-3 py-2 text-xs font-serif text-ink/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading lists…
              </p>
            ) : lists.length === 0 ? (
              <p className="px-3 py-2 text-xs font-serif text-ink/50">
                No lists yet. Make one below — e.g. “To print”.
              </p>
            ) : (
              lists.map((list) => {
                const inList = memberIds.has(list.id);
                return (
                  <button
                    key={list.id}
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void (inList && single ? remove(list) : add(list))}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-serif text-ink hover:bg-wine/5 disabled:opacity-60"
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        inList ? 'border-wine bg-wine text-parchment' : 'border-wine/30',
                      )}
                    >
                      {busyId === list.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-ink/60" />
                      ) : inList ? (
                        <Check className="h-3 w-3" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{list.name}</span>
                    <span className="text-[11px] text-ink/40">{list.item_count}</span>
                  </button>
                );
              })
            )}
          </div>

          <form
            className="flex items-center gap-1.5 border-t border-wine/10 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New list…"
              maxLength={80}
              className="h-8 font-serif text-sm"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newName.trim() || busyId !== null}
              className="h-8 bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              {busyId === '__new__' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
            </Button>
          </form>

          <Link
            href="/artworks/lists"
            className="block border-t border-wine/10 px-3 py-2 text-xs font-serif text-wine hover:bg-wine/5"
          >
            Manage lists →
          </Link>
        </PopoverContent>
      </Popover>
    </div>
  );
}
