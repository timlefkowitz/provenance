import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';

import { computeArtistMarketCapSeries } from '~/lib/portal-graphs/compute-artist-market-cap-series';
import { formatMoney } from '~/lib/portal-graphs/types';
import { ValueLineChart } from './value-line-chart';

interface ArtistMarketCapCardProps {
  artistAccountId: string;
}

function DeltaPill({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 || current === 0) return null;

  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-xs font-serif text-ink/50">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-serif text-emerald-700">
        <TrendingUp className="h-3 w-3" />
        +{pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-serif text-red-700">
      <TrendingDown className="h-3 w-3" />
      {pct}%
    </span>
  );
}

export async function ArtistMarketCapCard({ artistAccountId }: ArtistMarketCapCardProps) {
  const data = await computeArtistMarketCapSeries(artistAccountId);

  const previousPoint = data.series[0];
  const previousValue = previousPoint?.value_cents ?? 0;

  if (data.workCount === 0 || data.total_cents === 0) {
    return (
      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <CardTitle className="font-display text-xl text-wine">Your Market Cap</CardTitle>
          <p className="text-xs text-ink/50 font-serif">Total value of your body of work</p>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Palette className="h-10 w-10 text-wine/20 mx-auto mb-3" />
          <p className="text-ink/60 font-serif text-sm mb-2">
            Your market cap isn't calculated yet.
          </p>
          <p className="text-ink/40 font-serif text-xs mb-4">
            Add your works and enter a value when creating certificates — your market cap will grow as valuations accumulate.
          </p>
          <Button asChild variant="outline" className="font-serif border-wine/30 hover:bg-wine/10 text-sm">
            <Link href="/artworks/add">Add Your First Work →</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasBand = data.low_cents !== data.total_cents || data.high_cents !== data.total_cents;

  return (
    <Card className="border-wine/20 bg-parchment/60">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-display text-xl text-wine mb-1">Your Market Cap</CardTitle>
            <p className="text-xs text-ink/50 font-serif">
              {data.workCount} {data.workCount === 1 ? 'work' : 'works'} in body of work &middot; last 12 months
            </p>
          </div>
          <DeltaPill current={data.total_cents} previous={previousValue} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current total */}
        <div>
          <p className="text-4xl font-display font-bold text-wine tabular-nums">
            {formatMoney(data.total_cents)}
          </p>
          {hasBand && (
            <p className="text-xs text-ink/45 font-serif mt-1">
              Range: {formatMoney(data.low_cents)} &ndash; {formatMoney(data.high_cents)}
            </p>
          )}
        </div>

        {/* Chart */}
        <ValueLineChart series={data.series} height={180} />

        {/* Coverage footer */}
        <div className="flex items-center justify-between pt-1 border-t border-wine/10">
          <p className="text-[11px] font-serif text-ink/45">
            {data.valuationCoverage} of {data.workCount}{' '}
            {data.workCount === 1 ? 'work has' : 'works have'} a formal valuation
          </p>
          <Button asChild variant="ghost" size="sm" className="font-serif text-wine hover:text-wine/80 text-xs px-0 h-auto">
            <Link href="/artworks/my">View works →</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
