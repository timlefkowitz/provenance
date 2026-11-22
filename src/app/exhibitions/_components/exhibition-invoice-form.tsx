'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Check, Copy, X } from 'lucide-react';

import { toast } from '@kit/ui/sonner';

import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_HINT, FIELD_INPUT, FIELD_LABEL } from '~/components/editorial-form';
import { formatPrice } from '~/lib/cart/format';

import {
  cancelExhibitionInvoice,
  createExhibitionInvoice,
  type ExhibitionInvoiceSummary,
} from '../_actions/exhibition-invoices';

type Work = { artworkId: string; title: string; artistName: string | null; priceCents: number | null };

function toCents(value: string): number | null {
  const n = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/** Invoice the selected works to one buyer; they get a private link to pay. */
export function ExhibitionInvoiceForm({
  exhibitionId,
  works,
  onDone,
  onClear,
}: {
  exhibitionId: string;
  works: Work[];
  onDone: () => void;
  onClear: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(works.map((w) => [w.artworkId, w.priceCents ? String(w.priceCents / 100) : ''])),
  );
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [note, setNote] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [created, setCreated] = useState<string | null>(null);

  const cents = works.map((w) => toCents(prices[w.artworkId] ?? ''));
  const total = cents.reduce<number>((a, c) => a + (c ?? 0), 0);
  const missing = works.filter((_, i) => !cents[i]);

  function create() {
    if (missing.length > 0) {
      toast.error(`Add a price for ${missing.map((m) => `"${m.title}"`).join(', ')}`);
      return;
    }
    startTransition(async () => {
      const res = await createExhibitionInvoice({
        exhibitionId,
        items: works.map((w, i) => ({ artworkId: w.artworkId, priceCents: cents[i]! })),
        buyerName: buyerName || null,
        buyerEmail: buyerEmail || null,
        note: note || null,
        sendEmail: sendEmail && !!buyerEmail,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setCreated(res.url);
      toast.success(res.emailed ? `Invoice emailed to ${buyerEmail}` : 'Invoice created');
      router.refresh();
    });
  }

  if (created) {
    return (
      <div className="space-y-3 border border-editorial-border/25 bg-bone p-4">
        <p className="font-serif text-sm text-editorial-ink">Invoice ready. Share this private link with the buyer:</p>
        <CopyLink url={created} />
        <button
          type="button"
          className={BUTTON_SECONDARY}
          onClick={() => {
            setCreated(null);
            onDone();
          }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 border border-editorial-border/25 bg-bone p-4">
      <div className="flex items-center justify-between">
        <p className="font-serif text-sm font-semibold text-editorial-ink">
          Invoice {works.length} {works.length === 1 ? 'work' : 'works'}
        </p>
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 font-serif text-xs text-ink/50 hover:text-wine">
          <X className="h-3.5 w-3.5" /> Clear selection
        </button>
      </div>
      <ul className="divide-y divide-editorial-border/20">
        {works.map((w) => (
          <li key={w.artworkId} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-sm text-editorial-ink">{w.title}</p>
              {w.artistName && <p className="truncate font-serif text-xs text-editorial-ink/55">{w.artistName}</p>}
            </div>
            <span className="font-serif text-sm text-editorial-ink/50">$</span>
            <input
              inputMode="decimal"
              value={prices[w.artworkId] ?? ''}
              onChange={(e) => setPrices((p) => ({ ...p, [w.artworkId]: e.target.value }))}
              aria-label={`Invoice price for ${w.title}`}
              className={`${FIELD_INPUT} w-28`}
            />
          </li>
        ))}
      </ul>
      <p className="text-right font-serif text-sm text-editorial-ink">Total {formatPrice(total)}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={FIELD_LABEL} htmlFor="inv-name">Buyer name</label>
          <input id="inv-name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={FIELD_INPUT} />
        </div>
        <div>
          <label className={FIELD_LABEL} htmlFor="inv-email">Buyer email</label>
          <input
            id="inv-email"
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            className={FIELD_INPUT}
          />
        </div>
      </div>
      <div>
        <label className={FIELD_LABEL} htmlFor="inv-note">Note to the buyer (optional)</label>
        <textarea
          id="inv-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${FIELD_INPUT} h-auto py-2`}
        />
      </div>
      <label className="flex items-center gap-2 font-serif text-sm text-editorial-ink">
        <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
        Email the invoice to the buyer
      </label>
      <p className={FIELD_HINT}>
        The buyer pays every work at once with Apple Pay, Google Pay or card; no account needed. The works aren’t
        held until they check out, and your commission splits as for any sale from this show.
      </p>
      <button type="button" disabled={pending} onClick={create} className={BUTTON_PRIMARY}>
        {pending ? 'Creating…' : 'Create invoice'}
      </button>
    </div>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={url} className={`${FIELD_INPUT} flex-1 text-xs`} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className={BUTTON_SECONDARY}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error('Copy failed; select the link and copy it');
          }
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

const STATUS: Record<ExhibitionInvoiceSummary['status'], string> = {
  open: 'Open',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export function ExhibitionInvoiceList({
  invoices,
  showExhibition = false,
  title = 'Invoices',
}: {
  invoices: ExhibitionInvoiceSummary[];
  /** List across shows (Operations): name each invoice's show. */
  showExhibition?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (invoices.length === 0) return null;
  return (
    <div>
      <p className={FIELD_LABEL}>{title}</p>
      <ul className="divide-y divide-editorial-border/20 border-y border-editorial-border/20">
        {invoices.map((inv) => (
          <li key={inv.id} className="space-y-2 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-serif text-sm text-editorial-ink">
                {inv.buyerName || inv.buyerEmail || 'Buyer'} · {formatPrice(inv.totalCents)} ·{' '}
                {inv.workCount} {inv.workCount === 1 ? 'work' : 'works'}
              </p>
              <span
                className={
                  inv.status === 'paid'
                    ? 'font-serif text-xs text-emerald-700'
                    : inv.status === 'cancelled'
                      ? 'font-serif text-xs text-ink/40'
                      : 'font-serif text-xs text-wine'
                }
              >
                {STATUS[inv.status]} · {new Date(inv.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="truncate font-serif text-xs text-editorial-ink/55">
              {showExhibition && inv.exhibitionTitle ? (
                <Link href={`/exhibitions/${inv.exhibitionId}`} className="hover:text-wine hover:underline">
                  {inv.exhibitionTitle}
                </Link>
              ) : null}
              {showExhibition && inv.exhibitionTitle ? ' · ' : ''}
              {inv.titles.join(', ')}
            </p>
            {inv.status === 'open' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <CopyLink url={inv.url} />
                </div>
                <button
                  type="button"
                  disabled={pending}
                  className="font-serif text-xs text-ink/50 hover:text-wine"
                  onClick={() =>
                    startTransition(async () => {
                      const res = await cancelExhibitionInvoice(inv.exhibitionId, inv.id);
                      if (!res.success) toast.error(res.error ?? 'Could not cancel');
                      else router.refresh();
                    })
                  }
                >
                  Cancel invoice
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
