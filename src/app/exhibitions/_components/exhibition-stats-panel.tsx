import Link from 'next/link';
import { BadgeDollarSign, CalendarClock, MessageSquare, QrCode, ScanLine } from 'lucide-react';

import { loadExhibitionSellThrough } from '~/lib/collectors/load-exhibition-sell-through';
import { formatMoney } from '~/lib/portal-graphs/types';

import type { ExhibitionInquiry } from '../_actions/exhibition-inquiries';
import type { ReservationRequest } from '../_actions/reservation-requests';
import { getExhibitionScans } from '../_helpers/exhibition-scans';

const n = (v: number) => v.toLocaleString('en-US');
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;

type Tile = {
  label: string;
  value: string;
  detail: string;
  /** Where the detail lives; none when there's nothing to see yet. */
  href: string | null;
  icon: typeof ScanLine;
};

/**
 * Organiser-only numbers for a show: wall label scans during the show, scans
 * of the show's own QR code (poster, flyer, catalog), inquiries,
 * reservation requests and sales, each linking to the detail. Counts only;
 * the detail pages and panels apply their own privacy rules.
 */
export async function ExhibitionStatsPanel({
  exhibitionId,
  galleryOwnerId,
  userId,
  inquiries,
  reservations,
}: {
  exhibitionId: string;
  galleryOwnerId: string;
  userId: string;
  inquiries: ExhibitionInquiry[];
  reservations: ReservationRequest[];
}) {
  const [scans, salesResult] = await Promise.all([
    getExhibitionScans(userId, exhibitionId).catch((err) => {
      console.error('[Exhibitions] Stats: scans failed', { exhibitionId, err });
      return null;
    }),
    loadExhibitionSellThrough(exhibitionId, galleryOwnerId).catch((err) => {
      console.error('[Exhibitions] Stats: sell-through failed', { exhibitionId, err });
      return 'failed' as const;
    }),
  ]);

  const salesFailed = salesResult === 'failed';
  const sales = salesFailed ? null : salesResult;
  // Recorded prices, plus unpriced sales at the work's set value (est.), plus Provenance Value.
  const money = sales
    ? [
        sales.recordedCents > 0 ? `${formatMoney(sales.recordedCents)} recorded` : '',
        sales.estimatedCents > 0 ? `${formatMoney(sales.estimatedCents)} est. at set value` : '',
        sales.provenanceValueCents > 0 ? `${formatMoney(sales.provenanceValueCents)} Provenance Value` : '',
      ].filter(Boolean)
    : [];

  const works = scans?.works ?? [];
  const scanCount = works.reduce((sum, w) => sum + w.stats.duringShow, 0);
  const people = works.reduce((sum, w) => sum + w.stats.peopleDuringShow, 0);
  const scannedWorks = works.filter((w) => w.stats.duringShow > 0).length;
  const top = works[0]?.stats.duringShow ? works[0] : null;
  const poster = scans?.poster ?? null;

  const purchases = inquiries.filter((i) => i.inquiry_type === 'purchase').length;
  const pending = reservations.filter((r) => r.status === 'pending').length;
  const accepted = reservations.filter((r) => r.status === 'accepted').length;

  const tiles: Tile[] = [
    {
      label: 'Wall label scans',
      value: n(scanCount),
      detail:
        scanCount > 0
          ? `by ${plural(people, 'person', 'people')} · ${n(scannedWorks)} of ${plural(works.length, 'work')}`
          : works.length > 0
            ? 'No wall label scans yet'
            : 'No works in the show yet',
      href: `/exhibitions/${exhibitionId}/scans`,
      icon: ScanLine,
    },
    {
      label: 'Poster scans',
      value: n(poster?.total ?? 0),
      detail:
        poster && poster.total > 0
          ? `by ${plural(poster.people, 'person', 'people')} · the show's own QR code`
          : 'Poster, flyer and catalog QR code',
      href: poster && poster.total > 0 ? `/exhibitions/${exhibitionId}/scans` : null,
      icon: QrCode,
    },
    {
      label: 'Inquiries',
      value: n(inquiries.length),
      detail:
        inquiries.length === 0
          ? 'Since the show went public'
          : purchases > 0
            ? `${plural(purchases, 'purchase request')} · ${n(inquiries.length - purchases)} questions`
            : `${plural(inquiries.length, 'question')} about works`,
      href: inquiries.length ? '#inquiries' : null,
      icon: MessageSquare,
    },
    {
      label: 'Reservation requests',
      value: n(reservations.length),
      detail:
        reservations.length === 0
          ? 'Visitors can ask to reserve a work'
          : [pending ? `${n(pending)} waiting` : '', accepted ? `${n(accepted)} accepted` : '']
              .filter(Boolean)
              .join(' · ') || 'All answered',
      href: reservations.length ? '#reservations' : null,
      icon: CalendarClock,
    },
    {
      label: 'Sold',
      value: sales && sales.shownCount > 0 ? `${n(sales.soldCount)} of ${n(sales.shownCount)}` : '0',
      detail: salesFailed
        ? "Couldn't load sales right now"
        : sales && sales.soldCount > 0
          ? [
              ...money,
              `${plural(sales.collectorKeys.length, 'collector')}${sales.newCollectorKeys.length ? ` (${n(sales.newCollectorKeys.length)} new)` : ''}`,
            ].join(' · ')
          : sales && sales.shownCount > 0
            ? `${sales.sellThroughPct}% sell-through`
            : 'Nothing sold yet',
      href: sales && sales.soldCount > 0 ? '/portal/collectors' : null,
      icon: BadgeDollarSign,
    },
  ];

  return (
    <section aria-labelledby="exhibition-stats-heading" className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="exhibition-stats-heading"
          className="font-serif text-[11px] uppercase tracking-widest text-wine/60"
        >
          Show stats · only you and your team see these
        </h2>
        {top && (
          <p className="font-serif text-xs text-ink/50">
            Most scanned:{' '}
            <Link href={`/artworks/${top.id}/certificate`} className="text-ink/70 hover:text-wine hover:underline underline-offset-4">
              {top.title}
            </Link>{' '}
            ({plural(top.stats.duringShow, 'scan')})
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-wine/15 bg-wine/15 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(({ label, value, detail, href, icon: Icon }) => {
          const body = (
            <>
              <p className="flex items-center gap-1.5 font-serif text-[11px] uppercase tracking-widest text-ink/50">
                <Icon className="h-3.5 w-3.5 text-wine/60" />
                {label}
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink group-hover:text-wine">
                {value}
              </p>
              <p className="mt-0.5 font-serif text-xs leading-snug text-ink/55">{detail}</p>
            </>
          );
          return href ? (
            <Link
              key={label}
              href={href}
              className="group flex flex-col bg-parchment/60 p-4 transition-colors hover:bg-parchment"
            >
              {body}
            </Link>
          ) : (
            <div key={label} className="flex flex-col bg-parchment/60 p-4">
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
