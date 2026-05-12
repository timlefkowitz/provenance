import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, ImageIcon, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';

import { computePortfolioSeries } from '~/lib/portal-graphs/compute-portfolio-series';
import { formatMoney } from '~/lib/portal-graphs/types';
import { ValueLineChart } from './value-line-chart';

const DETAIL_HREF = '/portal/market-cap/collection';

interface PortfolioValueCardProps {
  userId: string;
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

export async function PortfolioValueCard({ userId }: PortfolioValueCardProps) {
  const data = await computePortfolioSeries(userId);

  const previousPoint = data.series[0];
  const previousValue = previousPoint?.value_cents ?? 0;

  if (data.workCount === 0 || data.total_cents === 0) {
    return (
      <Link href={DETAIL_HREF} className="group block">
        <Card className="border-wine/20 bg-parchment/60 transition-colors group-hover:bg-parchment/80 group-hover:border-wine/40">
          <CardHeader>
            <CardTitle className="font-display text-xl text-wine">Your Collection Market Cap</CardTitle>
            <p className="text-xs text-ink/50 font-serif">Total value of your collection</p>
          </CardHeader>
          <CardContent className="text-center py-8">
            <ImageIcon className="h-10 w-10 text-wine/20 mx-auto mb-3" />
            <p className="text-ink/60 font-serif text-sm mb-2">
              No valued works in your collection yet.
            </p>
            <p className="text-ink/40 font-serif text-xs mb-4">
              Enter a value when creating a certificate, or request a formal valuation, to see your collection grow here.
            </p>
            <Button asChild variant="outline" className="font-serif border-wine/30 hover:bg-wine/10 text-sm" onClick={(e) => e.stopPropagation()}>
              <Link href="/artworks/add">Add an Artwork →</Link>
            </Button>
          </CardContent>
        </Card>
      </Link>
    );
  }

  const hasBand = data.low_cents !== data.total_cents || data.high_cents !== data.total_cents;

  return (
    <Link href={DETAIL_HREF} className="group block">
      <Card className="border-wine/20 bg-parchment/60 transition-colors group-hover:bg-parchment/80 group-hover:border-wine/40">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="font-display text-xl text-wine mb-1 flex items-center gap-1">
                Your Collection Market Cap
                <ChevronRight className="h-4 w-4 text-wine/40 group-hover:text-wine transition-colors" />
              </CardTitle>
              <p className="text-xs text-ink/50 font-serif">
                {data.workCount} {data.workCount === 1 ? 'work' : 'works'} &middot; authenticated &amp; owned &middot; last 12 months
              </p>
            </div>
            <DeltaPill current={data.total_cents} previous={previousValue} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <ValueLineChart series={data.series} height={180} />

          <div className="flex items-center justify-between pt-1 border-t border-wine/10">
            <p className="text-[11px] font-serif text-ink/45">
              {data.valuationCoverage} of {data.workCount}{' '}
              {data.workCount === 1 ? 'work has' : 'works have'} a formal valuation
            </p>
            <span className="font-serif text-wine text-xs">
              See breakdown →
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
