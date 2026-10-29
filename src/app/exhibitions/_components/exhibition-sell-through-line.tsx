import Link from 'next/link';

import { loadExhibitionSellThrough } from '~/lib/collectors/load-exhibition-sell-through';
import { formatMoney } from '~/lib/portal-graphs/types';

/** Organiser-only summary: how much of the show sold and who it brought in. */
export async function ExhibitionSellThroughLine({
  exhibitionId,
  galleryOwnerId,
}: {
  exhibitionId: string;
  galleryOwnerId: string;
}) {
  const s = await loadExhibitionSellThrough(exhibitionId, galleryOwnerId);
  if (!s || s.shownCount === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-wine/15 bg-parchment/60 px-4 py-3 text-sm font-serif text-ink/70">
      <span>
        <span className="text-wine font-semibold tabular-nums">
          {s.soldCount} of {s.shownCount}
        </span>{' '}
        sold ({s.sellThroughPct}%)
      </span>
      {s.salesCents > 0 && <span className="tabular-nums">{formatMoney(s.salesCents)} in sales</span>}
      <span>
        {s.newCollectorKeys.length} new {s.newCollectorKeys.length === 1 ? 'collector' : 'collectors'}
      </span>
      <Link href="/portal/collectors" className="ml-auto text-wine underline underline-offset-4 text-xs">
        All collectors
      </Link>
    </div>
  );
}
