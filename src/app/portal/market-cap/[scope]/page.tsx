import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ImageIcon } from 'lucide-react';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  loadCollectionBreakdown,
  loadArtistBreakdown,
  loadGalleryBreakdown,
  type BreakdownRow,
} from '~/lib/portal-graphs/load-breakdown-rows';
import { computePortfolioSeries } from '~/lib/portal-graphs/compute-portfolio-series';
import { computeArtistMarketCapSeries } from '~/lib/portal-graphs/compute-artist-market-cap-series';
import { computeGalleryMarketCapSeries } from '~/lib/portal-graphs/compute-gallery-market-cap-series';
import { getUserGalleryProfiles } from '~/app/artworks/add/_actions/get-user-gallery-profiles';
import { ValueLineChart } from '../../_components/value-line-chart';
import { SourceSummary } from './_components/source-summary';
import { BreakdownRowComponent } from './_components/breakdown-row';
import { formatMoney } from '~/lib/portal-graphs/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Scope = 'artist' | 'collection' | 'gallery';

interface PageProps {
  params: Promise<{ scope: string }>;
}

function isValidScope(scope: string): scope is Scope {
  return scope === 'artist' || scope === 'collection' || scope === 'gallery';
}

const PAGE_TITLES: Record<Scope, string> = {
  artist: 'Your Artist Market Cap',
  collection: 'Your Collection Market Cap',
  gallery: 'Your Gallery Market Cap',
};

const PAGE_SUBTITLES: Record<Scope, string> = {
  artist: 'Total value of your works with a Certificate of Authenticity (COA)',
  collection: 'Total value of works in your collection (Certificates of Ownership)',
  gallery: 'Total value of works on your gallery roster',
};

function EmptyState({ scope }: { scope: Scope }) {
  const messages: Record<Scope, { heading: string; body: string }> = {
    artist: {
      heading: 'No COA works in your body of work yet.',
      body: 'Add your artworks and create Certificates of Authenticity with a declared value to see your artist market cap grow here.',
    },
    collection: {
      heading: 'No COO works in your collection yet.',
      body: 'Artworks with a Certificate of Ownership (COO) that have a declared or formal value will appear here.',
    },
    gallery: {
      heading: 'No works on your gallery roster yet.',
      body: 'Artworks posted under your gallery profile will appear here once they have a declared or formal value.',
    },
  };

  const { heading, body } = messages[scope];

  return (
    <div className="text-center py-16">
      <ImageIcon className="h-12 w-12 text-wine/20 mx-auto mb-4" />
      <p className="font-serif text-ink/60 text-base mb-2">{heading}</p>
      <p className="font-serif text-ink/40 text-sm mb-6 max-w-sm mx-auto">{body}</p>
      <Link
        href="/artworks/add"
        className="inline-flex items-center rounded-full border border-wine/30 bg-wine/5 px-4 py-2 text-sm font-serif text-wine hover:bg-wine/10 transition-colors"
      >
        Add an Artwork →
      </Link>
    </div>
  );
}

export default async function MarketCapBreakdownPage({ params }: PageProps) {
  const { scope: rawScope } = await params;

  if (!isValidScope(rawScope)) notFound();
  const scope = rawScope as Scope;

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) redirect('/auth/sign-in');

  let rows: BreakdownRow[];
  let series: Awaited<ReturnType<typeof computeArtistMarketCapSeries>>;

  if (scope === 'gallery') {
    console.log('[MarketCapPage] loading gallery scope', { userId: user.id });
    const galleryProfiles = await getUserGalleryProfiles(user.id);
    const galleryProfileIds = galleryProfiles
      .map((p: Record<string, unknown>) => p.id)
      .filter((id: unknown): id is string => typeof id === 'string');
    console.log('[MarketCapPage] gallery profile ids resolved', { galleryProfileIds });
    [rows, series] = await Promise.all([
      loadGalleryBreakdown(galleryProfileIds),
      computeGalleryMarketCapSeries(galleryProfileIds),
    ]);
  } else {
    [rows, series] = await Promise.all([
      scope === 'collection' ? loadCollectionBreakdown(user.id) : loadArtistBreakdown(user.id),
      scope === 'collection' ? computePortfolioSeries(user.id) : computeArtistMarketCapSeries(user.id),
    ]);
  }

  const title = PAGE_TITLES[scope];
  const subtitle = PAGE_SUBTITLES[scope];
  const total = series.total_cents;
  const hasBand =
    series.low_cents !== series.total_cents || series.high_cents !== series.total_cents;

  return (
    <div className="min-h-screen bg-parchment/30">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Back nav */}
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm font-serif text-ink/50 hover:text-wine transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>

        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-wine">{title}</h1>
          <p className="font-serif text-ink/50 text-sm">{subtitle}</p>
        </div>

        {/* Total + chart */}
        <div className="rounded-xl border border-wine/20 bg-white/70 p-6 space-y-4">
          <div>
            <p className="text-5xl font-display font-bold text-wine tabular-nums">
              {formatMoney(total)}
            </p>
            {hasBand && (
              <p className="text-xs text-ink/45 font-serif mt-1">
                Range: {formatMoney(series.low_cents)} &ndash; {formatMoney(series.high_cents)}
              </p>
            )}
            <p className="text-xs font-serif text-ink/40 mt-1">
              {rows.length} {rows.length === 1 ? 'work' : 'works'} &middot; last 12 months
            </p>
          </div>

          {series.series.length > 0 && (
            <ValueLineChart series={series.series} height={160} />
          )}
        </div>

        {/* Source summary */}
        {rows.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-serif text-sm font-semibold text-ink/60 uppercase tracking-wide">
              Value sources
            </h2>
            <SourceSummary rows={rows} />
          </div>
        )}

        {/* Artwork list */}
        <div className="space-y-2">
          <h2 className="font-serif text-sm font-semibold text-ink/60 uppercase tracking-wide">
            {rows.length > 0 ? `Artworks (${rows.length})` : 'Artworks'}
          </h2>

          {rows.length === 0 ? (
            <EmptyState scope={scope} />
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <BreakdownRowComponent
                  key={row.artwork_id}
                  row={row}
                  artworkHref={`/artworks/${row.artwork_id}/certificate`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
