'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Image as ImageIcon } from 'lucide-react';

import { Switch } from '@kit/ui/switch';
import { toast } from '@kit/ui/sonner';

import {
  BUTTON_PRIMARY,
  EditorialSectionHeader,
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
} from '~/components/editorial-form';
import { SoldDot } from '~/components/sold-dot';
import { formatPrice } from '~/lib/cart/format';
import { exhibitionSalesTotals } from '~/lib/exhibition-sales/sales-totals';

import {
  type ExhibitionSalesSummary,
  setExhibitionWorkPrice,
  updateExhibitionSalesSettings,
} from '../_actions/exhibition-sales';
import type { ExhibitionInvoiceSummary } from '../_actions/exhibition-invoices';
import { ExhibitionInvoiceForm, ExhibitionInvoiceList } from './exhibition-invoice-form';

function toCents(value: string): number | null {
  const n = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function toDollars(cents: number | null): string {
  return cents ? String(cents / 100) : '';
}

export function ExhibitionSalesPanel({
  exhibitionId,
  summary,
  invoices = [],
}: {
  exhibitionId: string;
  summary: ExhibitionSalesSummary;
  invoices?: ExhibitionInvoiceSummary[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(summary.enabled);
  const [commission, setCommission] = useState(String(summary.commissionPercent));
  // Works picked for an invoice.
  const [selected, setSelected] = useState<string[]>([]);
  const toggleSelected = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const selectedWorks = summary.works.filter((w) => selected.includes(w.artworkId) && !w.isSold);

  function saveSettings(nextEnabled = enabled) {
    const pct = Number(commission);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error('Commission must be between 0 and 100%');
      return;
    }
    startTransition(async () => {
      const res = await updateExhibitionSalesSettings({ exhibitionId, enabled: nextEnabled, commissionPercent: pct });
      if (!res.success) {
        toast.error(res.error);
        setEnabled(summary.enabled);
        return;
      }
      toast.success(
        nextEnabled
          ? res.listedCount > 0
            ? `Online sales are on: ${res.listedCount} ${res.listedCount === 1 ? 'work is' : 'works are'} now for sale`
            : 'Online sales are on'
          : 'Online sales are off',
      );
      router.refresh();
    });
  }

  const forSaleCount = summary.works.filter((w) => w.forSale && !w.isSold).length;
  const typedPct = Number(commission);
  const pctForTotals = Number.isFinite(typedPct) && typedPct >= 0 && typedPct <= 100 ? typedPct : summary.commissionPercent;
  const totals = exhibitionSalesTotals(summary.works, pctForTotals);
  const pctLabel = `${Number(pctForTotals.toFixed(2))}%`;

  return (
    <section id="online-sales" className="mt-16 border-t border-editorial-border/30 pt-10 scroll-mt-8">
      <EditorialSectionHeader
        eyebrow="Online sales"
        title="Sell works from this show"
        description="Visitors add priced works to a cart and pay with Apple Pay, Google Pay or card. Your commission is paid to you; the rest goes to the artist. Provenance’s fee and card processing are shared in the same proportion. You arrange delivery with the buyer."
      />

      <div className="border border-editorial-border/25 bg-bone p-5 space-y-5">
        <div className="flex flex-wrap items-end gap-6">
          <label className="flex items-center gap-3">
            <Switch
              checked={enabled}
              disabled={pending}
              onCheckedChange={(v) => {
                setEnabled(v);
                saveSettings(v);
              }}
              aria-label="Sell works online"
            />
            <span className="font-serif text-sm text-editorial-ink">Sell works online</span>
          </label>
          <div>
            <label htmlFor="commission" className={FIELD_LABEL}>
              Gallery commission %
            </label>
            <div className="flex items-center gap-2">
              <input
                id="commission"
                inputMode="decimal"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className={`${FIELD_INPUT} w-24`}
              />
              <button type="button" disabled={pending} onClick={() => saveSettings()} className={BUTTON_PRIMARY}>
                Save
              </button>
            </div>
          </div>
        </div>
        <p className={FIELD_HINT}>
          {enabled
            ? `${forSaleCount} of ${summary.works.length} works can be bought right now.`
            : 'Off: switching it on offers every work below that has a price, except ones marked NFS. Prices start from the value each artist recorded.'}
        </p>

        {totals.sellableCount > 0 && (
          <div>
            <dl className="grid grid-cols-1 gap-px border border-editorial-border/20 bg-editorial-border/20 sm:grid-cols-3">
              <div className="bg-bone p-4">
                <dt className={FIELD_LABEL}>Value of works that can sell</dt>
                <dd className="font-fraunces text-2xl text-editorial-ink">{formatPrice(totals.sellableCents)}</dd>
                <dd className={FIELD_HINT}>
                  {totals.sellableCount} {totals.sellableCount === 1 ? 'work' : 'works'}
                  {enabled ? ` · ${totals.forSaleCount} for sale now (${formatPrice(totals.forSaleCents)})` : ''}
                </dd>
              </div>
              <div className="bg-bone p-4">
                <dt className={FIELD_LABEL}>Gallery commission if all sell</dt>
                <dd className="font-fraunces text-2xl text-editorial-ink">{formatPrice(totals.commissionCents)}</dd>
                <dd className={FIELD_HINT}>at {pctLabel}</dd>
              </div>
              <div className="bg-bone p-4">
                <dt className={FIELD_LABEL}>Artists receive if all sell</dt>
                <dd className="font-fraunces text-2xl text-editorial-ink">{formatPrice(totals.artistsCents)}</dd>
                <dd className={FIELD_HINT}>the other {Number((100 - pctForTotals).toFixed(2))}%</dd>
              </div>
            </dl>
            <p className={`${FIELD_HINT} mt-2`}>
              At current prices, before card processing and Provenance’s fee, which come out of each share in proportion.
              {[
                totals.soldCount ? `${totals.soldCount} sold` : '',
                totals.nfsCount ? `${totals.nfsCount} NFS` : '',
                totals.noPriceCount ? `${totals.noPriceCount} without a price` : '',
              ]
                .filter(Boolean)
                .join(' · ')
                .replace(/^(.+)$/, ' Not counted: $1.')}
            </p>
          </div>
        )}

        {selectedWorks.length > 0 ? (
          <ExhibitionInvoiceForm
            key={selectedWorks.map((w) => w.artworkId).join(',')}
            exhibitionId={exhibitionId}
            works={selectedWorks}
            onDone={() => setSelected([])}
            onClear={() => setSelected([])}
          />
        ) : (
          summary.works.some((w) => !w.isSold) && (
            <p className={FIELD_HINT}>
              Tick works below to invoice them to a buyer: they get a private link to pay for all of them at once.
            </p>
          )
        )}

        {summary.works.length === 0 ? (
          <p className={FIELD_HINT}>Add works to the show to price them.</p>
        ) : (
          <ul className="divide-y divide-editorial-border/20 border-y border-editorial-border/20">
            {summary.works.map((w) => (
              <WorkPriceRow
                key={`${w.artworkId}:${w.forSale}:${w.priceCents ?? ''}`}
                exhibitionId={exhibitionId}
                work={w}
                selected={selected.includes(w.artworkId)}
                onToggleSelected={() => toggleSelected(w.artworkId)}
              />
            ))}
          </ul>
        )}

        <ExhibitionInvoiceList exhibitionId={exhibitionId} invoices={invoices} />
      </div>
    </section>
  );
}

function WorkPriceRow({
  exhibitionId,
  work,
  selected,
  onToggleSelected,
}: {
  exhibitionId: string;
  work: ExhibitionSalesSummary['works'][number];
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(toDollars(work.priceCents));
  const [forSale, setForSale] = useState(work.forSale);
  const [pending, startTransition] = useTransition();

  function save(nextForSale = forSale) {
    const cents = price.trim() ? toCents(price) : null;
    if (price.trim() && !cents) {
      toast.error('Enter a price like 1200 or 1,200.00');
      return;
    }
    startTransition(async () => {
      const res = await setExhibitionWorkPrice({
        exhibitionId,
        artworkId: work.artworkId,
        priceCents: cents,
        forSale: nextForSale && !!cents,
      });
      if (!res.success) {
        toast.error(res.error);
        setForSale(work.forSale);
        return;
      }
      setForSale(nextForSale && !!cents);
      toast.success('Saved');
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <input
        type="checkbox"
        checked={selected}
        disabled={work.isSold}
        onChange={onToggleSelected}
        aria-label={`Select ${work.title} for an invoice`}
        className="h-4 w-4 shrink-0 accent-[var(--color-wine,#7a1f2b)] disabled:opacity-30"
      />
      {work.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={work.imageUrl} alt="" className="h-12 w-12 shrink-0 object-cover" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-wine/5">
          <ImageIcon className="h-4 w-4 text-wine/25" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-sm text-editorial-ink">{work.title}</p>
        {work.artistName && <p className="truncate font-serif text-xs text-editorial-ink/55">{work.artistName}</p>}
        {!work.isSold && (work.nfs || work.priceSource === 'artist' || !work.priceCents) && (
          <p className="font-serif text-[11px] text-editorial-ink/45">
            {work.nfs
              ? 'Artist marked NFS (not for sale)'
              : work.priceSource === 'artist'
                ? 'Price from the artist’s recorded value'
                : 'No value recorded: add a price to sell it'}
          </p>
        )}
      </div>
      {work.isSold ? (
        <span className="inline-flex items-center gap-1.5 font-serif text-xs text-ink/55">
          <SoldDot className="h-2 w-2" /> Sold
        </span>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <span className="font-serif text-sm text-editorial-ink/50">$</span>
            <input
              inputMode="decimal"
              value={price}
              placeholder="Price"
              aria-label={`Price for ${work.title}`}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={() => {
                if ((toCents(price) ?? null) !== work.priceCents) save();
              }}
              className={`${FIELD_INPUT} w-28`}
            />
          </div>
          <label className="flex items-center gap-2">
            <Switch
              checked={forSale}
              disabled={pending}
              onCheckedChange={(v) => save(v)}
              aria-label={`Offer ${work.title} for sale`}
            />
            <span className="font-serif text-xs text-editorial-ink/70">For sale</span>
          </label>
        </>
      )}
    </li>
  );
}
