import Link from 'next/link';

import type { CollectorSummary } from '~/lib/collectors/group-collectors';
import type { GalleryExhibition } from '~/lib/collectors/load-gallery-collector-data';
import { formatMoney } from '~/lib/portal-graphs/types';
import { collectorLabel, formatDate } from './format';

interface CollectorsTableProps {
  collectors: CollectorSummary[];
  exhibitions: GalleryExhibition[];
}

function GainCell({ paid, now }: { paid: number; now: number }) {
  if (!paid || !now) return <span className="text-ink/40">—</span>;
  const pct = Math.round(((now - paid) / paid) * 100);
  if (pct === 0) return <span className="text-ink/50">0%</span>;
  return (
    <span className={pct > 0 ? 'text-emerald-700' : 'text-red-700'}>
      {pct > 0 ? '+' : ''}
      {pct}%
    </span>
  );
}

export function CollectorsTable({ collectors, exhibitions }: CollectorsTableProps) {
  const titleById = new Map(exhibitions.map((e) => [e.id, e.title]));

  return (
    <div className="space-y-2">
      <h2 className="font-serif text-sm font-semibold text-ink/60 uppercase tracking-wide">
        Collectors ({collectors.length})
      </h2>
      <div className="rounded-xl border border-wine/20 bg-white/70 overflow-x-auto">
        <table className="w-full text-sm font-serif">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink/50">
              <th className="py-2 px-3">Collector</th>
              <th className="py-2 px-3 text-right">Works</th>
              <th className="py-2 px-3 text-right">Spent</th>
              <th className="py-2 px-3 text-right">Value now</th>
              <th className="py-2 px-3 text-right">Change</th>
              <th className="py-2 px-3">Shows</th>
              <th className="py-2 px-3 whitespace-nowrap">Last purchase</th>
            </tr>
          </thead>
          <tbody>
            {collectors.map((c) => (
              <tr key={c.key} className="border-t border-wine/10 align-top">
                <td className="py-2 px-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.accountId ? (
                      <Link href={`/artists/${c.accountId}`} className="text-wine hover:underline">
                        {collectorLabel(c)}
                      </Link>
                    ) : (
                      <span className="text-ink">{collectorLabel(c)}</span>
                    )}
                    {c.isRepeat && (
                      <span className="rounded-full bg-wine/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-wine">
                        Repeat
                      </span>
                    )}
                  </div>
                  {c.email && c.email !== collectorLabel(c) && (
                    <p className="text-xs text-ink/45 break-all">{c.email}</p>
                  )}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">{c.purchaseCount}</td>
                <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                  {c.totalSpentCents ? formatMoney(c.totalSpentCents) : '—'}
                  {c.estimatedSpentCents > 0 && <p className="text-[11px] text-ink/45">incl. est.</p>}
                </td>
                <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                  {c.currentValueCents ? formatMoney(c.currentValueCents) : '—'}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  <GainCell paid={c.totalSpentCents} now={c.currentValueCents} />
                </td>
                <td className="py-2 px-3 text-ink/70 min-w-[10rem]">
                  {c.exhibitionIds.length
                    ? c.exhibitionIds.map((id) => titleById.get(id) ?? 'Exhibition').join(', ')
                    : '—'}
                </td>
                <td className="py-2 px-3 whitespace-nowrap">{formatDate(c.lastPurchaseAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] font-serif text-ink/45">
        Value now uses the latest formal valuation, else the Provenance Value (price plus exhibition, publication and sale premiums). Works you resold count for the latest buyer.
      </p>
    </div>
  );
}
