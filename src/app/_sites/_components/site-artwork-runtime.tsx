'use client';

/**
 * SiteArtworkRuntime — context + link component that drives the per-site
 * artwork click behavior (full page / quick-view popup / lightbox).
 *
 * Usage:
 *   1. Wrap the rendered template in <SiteArtworkRuntimeProvider site={site}>
 *   2. Replace every <Link href={`/works/${id}`}> thumbnail wrapper with
 *      <SiteArtworkLink artwork={artwork} className="..." />
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import type { SiteArtwork } from '~/app/_sites/types';

// ─── Context ────────────────────────────────────────────────────────────────

type RuntimeContextValue = {
  clickBehavior: 'page' | 'modal' | 'lightbox';
  artworks: SiteArtwork[];
  accentColor: string;
  sellingEnabled: boolean;
  activeId: string | null;
  open: (id: string) => void;
  close: () => void;
  prev: () => void;
  next: () => void;
};

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export function useSiteArtworkRuntime() {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error('useSiteArtworkRuntime must be used inside SiteArtworkRuntimeProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

type ProviderProps = {
  clickBehavior: 'page' | 'modal' | 'lightbox';
  artworks: SiteArtwork[];
  accentColor: string;
  sellingEnabled: boolean;
  children: ReactNode;
};

export function SiteArtworkRuntimeProvider({
  clickBehavior,
  artworks,
  accentColor,
  sellingEnabled,
  children,
}: ProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const open = useCallback((id: string) => setActiveId(id), []);
  const close = useCallback(() => setActiveId(null), []);

  const prev = useCallback(() => {
    setActiveId((current) => {
      if (!current) return current;
      const idx = artworks.findIndex((a) => a.id === current);
      if (idx <= 0) return current;
      return artworks[idx - 1].id;
    });
  }, [artworks]);

  const next = useCallback(() => {
    setActiveId((current) => {
      if (!current) return current;
      const idx = artworks.findIndex((a) => a.id === current);
      if (idx < 0 || idx >= artworks.length - 1) return current;
      return artworks[idx + 1].id;
    });
  }, [artworks]);

  return (
    <RuntimeContext.Provider value={{ clickBehavior, artworks, accentColor, sellingEnabled, activeId, open, close, prev, next }}>
      {children}
    </RuntimeContext.Provider>
  );
}

// ─── SiteArtworkLink ─────────────────────────────────────────────────────────

type LinkProps = {
  artwork: SiteArtwork;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
};

/**
 * Drop-in replacement for <Link href={`/works/${artwork.id}`}>…</Link>.
 *
 * - behavior === 'page'     → renders a regular Next.js Link (identical to before)
 * - behavior === 'modal'    → renders a <button> that opens the quick-view popup
 * - behavior === 'lightbox' → renders a <button> that opens the full-screen lightbox
 */
export function SiteArtworkLink({ artwork, className, style, children }: LinkProps) {
  // Gracefully fall back when rendered outside a provider (e.g. preview frames
  // before the provider is mounted, or SSR-only template pages).
  const ctx = useContext(RuntimeContext);

  if (!ctx || ctx.clickBehavior === 'page') {
    return (
      <Link href={`/works/${artwork.id}`} className={className} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => ctx.open(artwork.id)}
      className={className}
      style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left', ...style }}
    >
      {children}
    </button>
  );
}
