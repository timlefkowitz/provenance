'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock, Heart, Plus, Search, Shuffle, SlidersHorizontal, Users, X } from 'lucide-react';
import { FeedSlide } from './feed-slide';
import type { FeedArtwork } from './artist-panel';

const PAGE_SIZE = 10;

type SortMode = 'shuffle' | 'recent' | 'top' | 'following';

const SORT_OPTIONS: {
  value: SortMode;
  label: string;
  icon: React.ElementType;
  requiresAuth: boolean;
}[] = [
  { value: 'shuffle', label: 'Default', icon: Shuffle, requiresAuth: false },
  { value: 'recent', label: 'Most Recent', icon: Clock, requiresAuth: false },
  { value: 'top', label: 'Top Favorited', icon: Heart, requiresAuth: false },
  { value: 'following', label: 'Following', icon: Users, requiresAuth: true },
];

export function ArtworkFeed({
  currentUserId,
  isSignedIn,
}: {
  currentUserId?: string;
  isSignedIn: boolean;
}) {
  const seedRef = useRef(crypto.randomUUID());
  const [items, setItems] = useState<FeedArtwork[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('shuffle');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (pageOffset: number, q: string, append: boolean, sort: SortMode) => {
      const params = new URLSearchParams({
        seed: seedRef.current,
        offset: String(pageOffset),
        limit: String(PAGE_SIZE),
        sort,
      });
      if (q.trim()) params.set('q', q.trim());

      console.log('[ArtworkFeed] Fetching feed page', { pageOffset, q: q || null, sort });

      const res = await fetch(`/api/artworks/feed?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load feed');

      const data = (await res.json()) as { items: FeedArtwork[]; hasMore: boolean };

      if (append) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
        scrollRef.current?.scrollTo({ top: 0 });
      }
      setOffset(pageOffset + data.items.length);
      setHasMore(data.hasMore);
    },
    [],
  );

  const loadInitial = useCallback(
    async (q: string, sort: SortMode) => {
      setLoading(true);
      try {
        await fetchPage(0, q, false, sort);
        console.log('[ArtworkFeed] Initial feed loaded');
      } catch (err) {
        console.error('[ArtworkFeed] Failed to load initial feed', err);
        setItems([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(offset, searchQuery, true, sortMode);
      console.log('[ArtworkFeed] Loaded more feed items');
    } catch (err) {
      console.error('[ArtworkFeed] Failed to load more', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, offset, searchQuery, sortMode, fetchPage]);

  useEffect(() => {
    loadInitial(searchQuery, sortMode);
  }, [searchQuery, sortMode, loadInitial]);

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [filterOpen]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore();
        }
      },
      { root, rootMargin: '200% 0px', threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMore]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      seedRef.current = crypto.randomUUID();
      setOffset(0);
      setHasMore(true);
      setSearchQuery(value);
    }, 400);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchOpen(false);
    seedRef.current = crypto.randomUUID();
    setOffset(0);
    setHasMore(true);
    setSearchQuery('');
  };

  const selectSort = (mode: SortMode) => {
    setFilterOpen(false);
    if (mode === sortMode) return;
    seedRef.current = crypto.randomUUID();
    setOffset(0);
    setHasMore(true);
    setSortMode(mode);
  };

  return (
    <div className="relative h-[calc(100dvh-var(--nav-h))] bg-parchment">
      {/* Floating controls — filter + search */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {/* Filter button + dropdown */}
        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className="relative p-2 rounded-full bg-parchment/60 backdrop-blur-sm text-ink/50 hover:text-wine transition-colors"
            aria-label="Filter artworks"
            aria-expanded={filterOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {/* Active sort indicator dot */}
            {sortMode !== 'shuffle' && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-wine" aria-hidden />
            )}
          </button>

          {filterOpen && (
            <div className="absolute top-full right-0 mt-2 w-44 rounded-xl bg-parchment/95 backdrop-blur-sm shadow-lg border border-wine/10 overflow-hidden py-1">
              {SORT_OPTIONS.map(({ value, label, icon: Icon, requiresAuth }) => {
                const disabled = requiresAuth && !isSignedIn;
                const active = sortMode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => !disabled && selectSort(value)}
                    disabled={disabled}
                    title={disabled ? 'Sign in to view artists you follow' : undefined}
                    className={[
                      'flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-serif transition-colors text-left',
                      active
                        ? 'text-wine bg-wine/8'
                        : disabled
                          ? 'text-ink/30 cursor-not-allowed'
                          : 'text-ink/70 hover:text-wine hover:bg-wine/5',
                    ].join(' ')}
                    aria-pressed={active}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {label}
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-wine shrink-0" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Search button / expanded search bar */}
        {searchOpen ? (
          <div className="flex items-center gap-2 bg-parchment/80 backdrop-blur-sm rounded-full pl-4 pr-2 py-1.5 shadow-sm">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Artist, title, medium"
              autoFocus
              className="w-44 sm:w-56 bg-transparent text-sm font-serif text-ink placeholder:text-ink/40 outline-none"
            />
            <button
              type="button"
              onClick={clearSearch}
              className="p-1 text-ink/50 hover:text-wine transition-colors"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-full bg-parchment/60 backdrop-blur-sm text-ink/50 hover:text-wine transition-colors"
            aria-label="Search artworks"
          >
            <Search className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Floating add button */}
      {isSignedIn && (
        <Link
          href="/artworks/add"
          className="absolute bottom-6 right-4 z-20 p-3 rounded-full bg-wine text-parchment hover:bg-wine/90 transition-colors shadow-sm"
          aria-label="Add artwork"
        >
          <Plus className="h-5 w-5" />
        </Link>
      )}

      {/* Feed */}
      {loading ? (
        <div className="h-full flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-wine/20 border-t-wine animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center gap-2 px-8 text-center">
          <p className="text-sm text-ink/50 font-serif">
            {sortMode === 'following'
              ? 'No artworks from artists you follow yet.'
              : 'No artworks found'}
          </p>
          {sortMode === 'following' && (
            <p className="text-xs text-ink/35 font-serif">
              Follow artists from their profiles to see their work here.
            </p>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto snap-y snap-mandatory overscroll-y-contain"
        >
          {items.map((artwork, i) => (
            <FeedSlide
              key={`${artwork.id}-${i}`}
              artwork={artwork}
              currentUserId={currentUserId}
              priority={i === 0}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-px snap-start shrink-0" />

          {loadingMore && (
            <div className="h-16 flex items-center justify-center snap-start shrink-0">
              <div className="h-5 w-5 rounded-full border-2 border-wine/20 border-t-wine animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
