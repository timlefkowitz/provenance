'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, X } from 'lucide-react';
import { FeedSlide } from './feed-slide';
import type { FeedArtwork } from './artist-panel';

const PAGE_SIZE = 10;

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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (pageOffset: number, q: string, append: boolean) => {
      const params = new URLSearchParams({
        seed: seedRef.current,
        offset: String(pageOffset),
        limit: String(PAGE_SIZE),
      });
      if (q.trim()) params.set('q', q.trim());

      console.log('[ArtworkFeed] Fetching feed page', { pageOffset, q: q || null });

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
    async (q: string) => {
      setLoading(true);
      try {
        await fetchPage(0, q, false);
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
      await fetchPage(offset, searchQuery, true);
      console.log('[ArtworkFeed] Loaded more feed items');
    } catch (err) {
      console.error('[ArtworkFeed] Failed to load more', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, offset, searchQuery, fetchPage]);

  useEffect(() => {
    loadInitial(searchQuery);
  }, [searchQuery, loadInitial]);

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

  return (
    <div className="relative h-[calc(100dvh-var(--nav-h))] bg-parchment">
      {/* Floating search */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
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
        <div className="h-full flex items-center justify-center">
          <p className="text-sm text-ink/50 font-serif">No artworks found</p>
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
