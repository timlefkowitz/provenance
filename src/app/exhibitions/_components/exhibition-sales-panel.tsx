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

import {
  type ExhibitionSalesSummary,
  setExhibitionWorkPrice,
  updateExhibitionSalesSettings,
} from '../_actions/exhibition-sales';

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
}: {
  exhibitionId: string;
  summary: ExhibitionSalesSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(summary.enabled);
  const [commission, setCommission] = useState(String(summary.commissionPercent));

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
      toast.success(nextEnabled ? 'Online sales are on' : 'Online sales are off');
      router.refresh();
    });
  }

  const forSaleCount = summary.works.filter((w) => w.forSale && !w.isSold).length;

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
            : 'Off: prices you set below are saved but nothing can be bought.'}
        </p>

        {summary.works.length === 0 ? (
          <p className={FIELD_HINT}>Add works to the show to price them.</p>
        ) : (
          <ul className="divide-y divide-editorial-border/20 border-y border-editorial-border/20">
            {summary.works.map((w) => (
              <WorkPriceRow key={w.artworkId} exhibitionId={exhibitionId} work={w} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function WorkPriceRow({
  exhibitionId,
  work,
}: {
  exhibitionId: string;
  work: ExhibitionSalesSummary['works'][number];
}) {
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
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
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
