import Link from 'next/link';

import type { ExhibitionSellThrough } from '~/lib/collectors/group-collectors';
import type { GalleryExhibition } from '~/lib/collectors/load-gallery-collector-data';
import { formatMoney } from '~/lib/portal-graphs/types';
import { formatDate } from './format';

interface SellThroughTableProps {
  exhibitions: GalleryExhibition[];
  sellThrough: ExhibitionSellThrough[];
}

export function SellThroughTable({ exhibitions, sellThrough }: SellThroughTableProps) {
  const byId = new Map(sellThrough.map((s) => [s.exhibitionId, s]));
  const rows = exhibitions.filter((e) => (byId.get(e.id)?.shownCount ?? 0) > 0);

  return (
    <div className="space-y-2">
      <h2 className="font-serif text-sm font-semibold text-ink/60 uppercase tracking-wide">
        Sell-through by exhibition
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm font-serif text-ink/50">
          Exhibitions with selected works will show their sell-through here.
        </p>
      ) : (
        <div className="rounded-xl border border-wine/20 bg-white/70 overflow-x-auto">
          <table className="w-full text-sm font-serif">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink/50">
                <th className="py-2 px-3">Exhibition</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">Sold / shown</th>
                <th className="py-2 px-3 text-right">Sell-through</th>
                <th className="py-2 px-3 text-right">Sales</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">New collectors</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const s = byId.get(e.id)!;
                return (
                  <tr key={e.id} className="border-t border-wine/10 align-top">
                    <td className="py-2 px-3">
                      <Link href={`/exhibitions/${e.id}`} className="text-wine hover:underline">
                        {e.title}
                      </Link>
                      <p className="text-xs text-ink/45">{formatDate(e.start_date ?? e.created_at)}</p>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {s.soldCount} / {s.shownCount}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{s.sellThroughPct}%</td>
                    <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                      {s.salesCents ? formatMoney(s.salesCents) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{s.newCollectorKeys.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
