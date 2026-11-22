'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { sendNotificationEmail } from '~/lib/email';
import { loadExhibitionListings } from '~/lib/exhibition-sales/load-listings';
import { invoiceUrl, newInvoiceToken } from '~/lib/invoices/invoices';
import { asUntyped } from '~/lib/supabase-untyped';

export type ExhibitionInvoiceSummary = {
  id: string;
  url: string;
  buyerName: string | null;
  buyerEmail: string | null;
  status: 'open' | 'paid' | 'cancelled';
  totalCents: number;
  workCount: number;
  titles: string[];
  createdAt: string;
};

const CreateSchema = z.object({
  exhibitionId: z.string().uuid(),
  items: z
    .array(z.object({ artworkId: z.string().uuid(), priceCents: z.number().int().positive().max(2_000_000_000) }))
    .min(1)
    .max(25),
  buyerName: z.string().trim().max(200).optional().nullable(),
  buyerEmail: z.string().trim().email().max(320).optional().nullable().or(z.literal('')),
  note: z.string().trim().max(2000).optional().nullable(),
  sendEmail: z.boolean().optional(),
});

async function requireManager(exhibitionId: string) {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: 'You must be signed in' } as const;
  const admin = asUntyped(getSupabaseServerAdminClient());
  const loaded = await loadExhibitionListings(admin, exhibitionId);
  if (!loaded) return { error: 'Exhibition not found' } as const;
  if (!(await canManageExhibition(user.id, loaded.exhibition.gallery_id))) {
    return { error: 'Only the show’s gallery can send invoices' } as const;
  }
  return { user, admin, loaded } as const;
}

/**
 * A gallery picks works from its show and invoices a buyer: a private link
 * where they pay for all of them at once (Apple Pay, Google Pay or card).
 */
export async function createExhibitionInvoice(
  input: z.infer<typeof CreateSchema>,
): Promise<{ success: true; url: string; emailed: boolean } | { success: false; error: string }> {
  try {
    const parsed = CreateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Check the works, prices and buyer email' };
    const { exhibitionId, items, note, sendEmail } = parsed.data;
    const buyerName = parsed.data.buyerName?.trim() || null;
    const buyerEmail = parsed.data.buyerEmail?.trim().toLowerCase() || null;
    if (sendEmail && !buyerEmail) return { success: false, error: 'Add the buyer’s email to send the invoice' };

    const ctx = await requireManager(exhibitionId);
    if ('error' in ctx) return { success: false, error: ctx.error! };
    const { user, admin, loaded } = ctx;

    const titles: string[] = [];
    for (const item of items) {
      const listing = loaded.listings.get(item.artworkId);
      if (!listing) return { success: false, error: 'A selected work is no longer in the show' };
      if (listing.isSold) return { success: false, error: `"${listing.title}" is already sold` };
      titles.push(listing.title);
    }

    const token = newInvoiceToken();
    const { data: invoice, error } = await admin
      .from('sale_invoices')
      .insert({
        token,
        exhibition_id: exhibitionId,
        gallery_account_id: loaded.exhibition.gallery_id,
        created_by: user.id,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        note: note?.trim() || null,
        currency: 'usd',
      })
      .select('id')
      .single();
    if (error || !invoice) {
      console.error('[Invoices] create failed', { exhibitionId, error });
      return { success: false, error: 'Could not create the invoice' };
    }
    const { error: itemsErr } = await admin.from('sale_invoice_items').insert(
      items.map((i, idx) => ({
        invoice_id: invoice.id,
        artwork_id: i.artworkId,
        title: titles[idx],
        price_cents: i.priceCents,
      })),
    );
    if (itemsErr) {
      console.error('[Invoices] items insert failed', { invoiceId: invoice.id, itemsErr });
      await admin.from('sale_invoices').update({ status: 'cancelled' }).eq('id', invoice.id);
      return { success: false, error: 'Could not create the invoice' };
    }

    const url = invoiceUrl(token);
    let emailed = false;
    if (sendEmail && buyerEmail) {
      const total = items.reduce((a, i) => a + i.priceCents, 0);
      const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total / 100);
      try {
        await sendNotificationEmail(buyerEmail, buyerName || '', `Your invoice from ${loaded.exhibition.title}`, {
          title: `Your invoice: ${titles.join(', ')}`,
          body: `${titles.length === 1 ? 'This work is' : 'These works are'} ready for you to buy (${money}). Pay securely with Apple Pay, Google Pay or card; you'll receive each work's Certificate of Ownership.${note?.trim() ? `\n\n${note.trim()}` : ''}`,
          ctaUrl: url,
          ctaLabel: 'View and pay',
        });
        emailed = true;
      } catch (err) {
        console.error('[Invoices] email failed', { invoiceId: invoice.id, err });
      }
    }

    console.log('[Invoices] created', { invoiceId: invoice.id, exhibitionId, works: items.length, emailed });
    revalidatePath(`/exhibitions/${exhibitionId}/edit`);
    return { success: true, url, emailed };
  } catch (err) {
    console.error('[Invoices] create threw', err);
    return { success: false, error: 'Could not create the invoice' };
  }
}

export async function listExhibitionInvoices(exhibitionId: string): Promise<ExhibitionInvoiceSummary[]> {
  const ctx = await requireManager(exhibitionId);
  if ('error' in ctx) return [];
  const { admin } = ctx;
  const { data: invoices } = await admin
    .from('sale_invoices')
    .select('id, token, buyer_name, buyer_email, status, created_at')
    .eq('exhibition_id', exhibitionId)
    .order('created_at', { ascending: false })
    .limit(50);
  const rows = invoices ?? [];
  if (rows.length === 0) return [];
  const { data: items } = await admin
    .from('sale_invoice_items')
    .select('invoice_id, title, price_cents')
    .in(
      'invoice_id',
      rows.map((r) => r.id),
    );
  return rows.map((r) => {
    const mine = (items ?? []).filter((i) => i.invoice_id === r.id);
    return {
      id: r.id as string,
      url: invoiceUrl(r.token as string),
      buyerName: (r.buyer_name as string | null) ?? null,
      buyerEmail: (r.buyer_email as string | null) ?? null,
      status: r.status as ExhibitionInvoiceSummary['status'],
      totalCents: mine.reduce((a, i) => a + (i.price_cents as number), 0),
      workCount: mine.length,
      titles: mine.map((i) => (i.title as string) || 'Untitled'),
      createdAt: r.created_at as string,
    };
  });
}

export async function cancelExhibitionInvoice(
  exhibitionId: string,
  invoiceId: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireManager(exhibitionId);
  if ('error' in ctx) return { success: false, error: ctx.error };
  const { error } = await ctx.admin
    .from('sale_invoices')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('exhibition_id', exhibitionId)
    .eq('status', 'open');
  if (error) return { success: false, error: 'Could not cancel the invoice' };
  revalidatePath(`/exhibitions/${exhibitionId}/edit`);
  return { success: true };
}
