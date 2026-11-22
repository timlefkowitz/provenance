import 'server-only';

import { randomBytes } from 'node:crypto';

import { resolveCartItems, type ResolvedCartItem } from '~/lib/cart/resolve-cart';
import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';

export type InvoiceRow = {
  id: string;
  token: string;
  exhibition_id: string;
  gallery_account_id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  note: string | null;
  currency: string;
  status: 'open' | 'paid' | 'cancelled';
  order_id: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export type InvoiceItemRow = { artwork_id: string; title: string | null; price_cents: number };

export function newInvoiceToken(): string {
  return randomBytes(24).toString('base64url');
}

export function invoiceUrl(token: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return `${site}/invoice/${token}`;
}

export function isInvoiceExpired(inv: Pick<InvoiceRow, 'expires_at'>, now: Date = new Date()): boolean {
  return !!inv.expires_at && new Date(inv.expires_at).getTime() < now.getTime();
}

export async function loadInvoiceByToken(
  admin: UntypedSupabaseClient,
  token: string,
): Promise<{ invoice: InvoiceRow; items: InvoiceItemRow[] } | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = asUntyped(admin);
  const { data: invoice } = await db.from('sale_invoices').select('*').eq('token', token).maybeSingle();
  if (!invoice) return null;
  const { data: items } = await db
    .from('sale_invoice_items')
    .select('artwork_id, title, price_cents')
    .eq('invoice_id', invoice.id)
    .order('created_at', { ascending: true });
  return { invoice: invoice as InvoiceRow, items: (items ?? []) as InvoiceItemRow[] };
}

/**
 * The invoice's works, ready for checkout at the gallery's invoiced prices.
 * A gallery can invoice a work whether or not the show sells online or the
 * work carries a public price; it only can't be sold, held or gone.
 */
export async function resolveInvoiceItems(
  admin: UntypedSupabaseClient,
  invoice: InvoiceRow,
  items: InvoiceItemRow[],
): Promise<ResolvedCartItem[]> {
  const resolved = await resolveCartItems(
    admin,
    items.map((i) => ({ artworkId: i.artwork_id, exhibitionId: invoice.exhibition_id })),
  );
  const prices = new Map(items.map((i) => [i.artwork_id, i.price_cents]));
  return resolved.map((r) => {
    const invoiced = r.reason === 'sales_closed' || r.reason === 'not_for_sale' || r.reason === null;
    return {
      ...r,
      available: invoiced && !!r.artistAccountId,
      reason: invoiced ? null : r.reason,
      priceCents: prices.get(r.artworkId) ?? r.priceCents,
      currency: invoice.currency,
    };
  });
}
