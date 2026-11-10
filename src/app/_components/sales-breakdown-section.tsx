import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import type { CreditedSale } from '~/lib/sales/load-account-sales';
import type { SalesBreakdown } from '~/lib/portal-graphs/sales-breakdown';

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

function day(iso: string | null): string {
  if (!iso || iso.startsWith('1970')) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const th = 'py-2 px-3 text-right whitespace-nowrap';
const td = 'py-2 px-3 text-right tabular-nums whitespace-nowrap';

/** "$1,200" / "$450 est." / "—" for one money cell. */
function Amount({ recorded, estimated }: { recorded: number; estimated: number }) {
  if (!recorded && !estimated) return <>—</>;
  return (
    <>
      {money(recorded + estimated)}
      {estimated > 0 && (
        <span className="block text-[11px] text-ink/45">{recorded > 0 ? `${money(estimated)} ` : ''}est.</span>
      )}
    </>
  );
}

/**
 * Owner/team-only money view for the portal sales page. Sales recorded with
 * a price count at that price; sales sent without one (most Certificates of
 * Ownership) count at the work's set value, marked "est.". Provenance Value
 * is the set value plus documented-history premiums.
 */
export function SalesBreakdownSection({
  breakdown,
  recent,
  titles,
}: {
  breakdown: SalesBreakdown;
  recent: CreditedSale[];
  titles: Map<string, string>;
}) {
  const { totals } = breakdown;
  const tiles = [
    { label: 'Sales', value: String(totals.salesCount), note: 'Every certificate of each work, deduped' },
    { label: 'Recorded revenue', value: money(totals.recordedCents), note: 'Sales entered with a price' },
    { label: 'Estimated at set value', value: money(totals.estimatedCents), note: 'Unpriced sales at the work’s value' },
    { label: 'Provenance Value', value: money(totals.provenanceValueCents), note: 'Value plus exhibited, published and sold premiums' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-md border border-wine/15 bg-parchment/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-ink/50 font-serif">{t.label}</p>
            <p className="mt-1 text-xl font-serif text-ink tabular-nums">{t.value}</p>
            <p className="mt-1 text-[11px] font-serif text-ink/45">{t.note}</p>
          </div>
        ))}
      </div>

      {breakdown.byExhibition.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">By exhibition</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm font-serif">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink/50">
                  <th className="py-2 px-3">Exhibition</th>
                  <th className={th}>Sold / shown</th>
                  <th className={th}>Sell-through</th>
                  <th className={th}>Sales</th>
                  <th className={th}>Provenance Value</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.byExhibition.map((r) => (
                  <tr key={r.exhibitionId} className="border-t border-wine/10 align-top">
                    <td className="py-2 px-3">
                      <Link href={`/exhibitions/${r.exhibitionId}`} className="text-wine hover:underline">
                        {r.title}
                      </Link>
                      <p className="text-xs text-ink/45">{day(r.startDate)}</p>
                    </td>
                    <td className={td}>
                      {r.salesCount} / {r.shownCount}
                    </td>
                    <td className={td}>{r.sellThroughPct}%</td>
                    <td className={td}>
                      <Amount recorded={r.recordedCents} estimated={r.estimatedCents} />
                    </td>
                    <td className={td}>{r.provenanceValueCents ? money(r.provenanceValueCents) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {breakdown.byArtist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">By artist</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm font-serif">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink/50">
                  <th className="py-2 px-3">Artist</th>
                  <th className={th}>Sales</th>
                  <th className={th}>Revenue</th>
                  <th className={th}>Provenance Value</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.byArtist.map((r) => (
                  <tr key={r.artist} className="border-t border-wine/10">
                    <td className="py-2 px-3">{r.artist}</td>
                    <td className={td}>{r.salesCount}</td>
                    <td className={td}>
                      <Amount recorded={r.recordedCents} estimated={r.estimatedCents} />
                    </td>
                    <td className={td}>{r.provenanceValueCents ? money(r.provenanceValueCents) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Recent sales</CardTitle>
          <p className="text-xs text-ink/60 font-serif">
            Sales of works you sold, showed, hold or made, wherever the sale was recorded.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {recent.length === 0 ? (
            <p className="text-sm text-ink/60 font-serif">
              No recorded sales yet. Issue a Certificate of Ownership or mark a work sold to add one.
            </p>
          ) : (
            <table className="w-full text-sm font-serif">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink/50">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Work</th>
                  <th className="py-2 pr-3">Buyer</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3 text-right">Provenance Value</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-t border-wine/10 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{day(s.sold_at)}</td>
                    <td className="py-2 pr-3">
                      <Link href={`/artworks/${s.artwork_id}/certificate`} className="text-wine hover:underline">
                        {titles.get(s.artwork_id) || 'Untitled'}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {s.sold_to_name || s.sold_to_email || (s.sold_to_account_id ? 'Platform account' : '—')}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                      {s.money && s.money.cents > 0 ? money(s.money.cents) : '—'}
                      {s.money && s.money.cents > 0 && (
                        <span
                          className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                            s.money.estimated ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {s.money.estimated ? 'Set value' : 'Recorded'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                      {s.provenance_value_cents ? money(s.provenance_value_cents) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
