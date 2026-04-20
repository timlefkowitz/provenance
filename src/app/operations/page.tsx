/* eslint-disable @typescript-eslint/no-explicit-any -- Operations tables not in generated DB types */
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getActiveArtistSubscription } from '~/lib/subscription';
import { OperationsPageContent } from './_components/operations-page-content';

export const metadata = {
  title: 'Operations | Provenance',
  description: 'Loan agreements and invoices for your collection',
};

export type OperationsExhibitionRef = {
  id: string;
  title: string;
  start_date: string | null;
};

export type OperationsArtworkOption = {
  id: string;
  title: string;
  artist_name: string | null;
  exhibitions: OperationsExhibitionRef[];
};

export type LoanAgreementRow = {
  id: string;
  account_id: string;
  artwork_id: string;
  borrower_name: string;
  borrower_email: string | null;
  lender_name: string | null;
  lender_email: string | null;
  start_date: string | null;
  end_date: string | null;
  terms_text: string | null;
  conditions_text: string | null;
  insurance_requirements_text: string | null;
  status: string;
  signature_completed_at: string | null;
  signature_notes: string | null;
  created_at: string;
  updated_at: string;
  artwork: { id: string; title: string } | null;
};

export type InvoiceLineRow = {
  id: string;
  description: string;
  quantity: number;
  unit_amount_cents: number;
  sort_order: number;
};

export type InvoiceRow = {
  id: string;
  account_id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  status: string;
  currency: string;
  due_date: string | null;
  tax_cents: number;
  notes: string | null;
  artwork_id: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  invoice_line_items: InvoiceLineRow[];
};

export default async function OperationsPage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const subscription = await getActiveArtistSubscription(user.id);
  if (!subscription) {
    redirect('/subscription?upgrade=1');
  }

  const [loansRes, invoicesRes, artworksRes] = await Promise.all([
    (client as any)
      .from('artwork_loan_agreements')
      .select(
        `
        id,
        account_id,
        artwork_id,
        borrower_name,
        borrower_email,
        lender_name,
        lender_email,
        start_date,
        end_date,
        terms_text,
        conditions_text,
        insurance_requirements_text,
        status,
        signature_completed_at,
        signature_notes,
        created_at,
        updated_at,
        artwork:artworks(id, title)
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false }),
    (client as any)
      .from('invoices')
      .select(
        `
        id,
        account_id,
        invoice_number,
        client_name,
        client_email,
        status,
        currency,
        due_date,
        tax_cents,
        notes,
        artwork_id,
        sent_at,
        paid_at,
        created_at,
        updated_at,
        invoice_line_items(id, description, quantity, unit_amount_cents, sort_order)
      `,
      )
      .eq('account_id', user.id)
      .order('created_at', { ascending: false }),
    (client as any)
      .from('artworks')
      .select(
        `
        id,
        title,
        artist_name,
        exhibition_artworks (
          exhibition_id,
          exhibitions!exhibition_artworks_exhibition_id_fkey ( id, title, start_date )
        )
      `,
      )
      .eq('account_id', user.id)
      .order('title'),
  ]);

  if (loansRes.error) {
    console.error('[Operations] page: loans query failed', loansRes.error);
  }
  if (invoicesRes.error) {
    console.error('[Operations] page: invoices query failed', invoicesRes.error);
  }
  if (artworksRes.error) {
    console.error('[Operations] page: artworks query failed', artworksRes.error);
  }

  const rawLoans = (loansRes.data ?? []) as Record<string, unknown>[];
  const loans: LoanAgreementRow[] = rawLoans.map((row) => {
    const art = row.artwork as { id: string; title: string } | { id: string; title: string }[] | null;
    const artwork = Array.isArray(art) ? art[0] ?? null : art ?? null;
    return { ...(row as unknown as LoanAgreementRow), artwork };
  });

  const rawInvoices = (invoicesRes.data ?? []) as Record<string, unknown>[];
  const invoices: InvoiceRow[] = rawInvoices.map((inv) => {
    const lines = (inv.invoice_line_items as InvoiceLineRow[] | null) ?? [];
    const sorted = [...lines].sort((a, b) => a.sort_order - b.sort_order);
    return { ...(inv as unknown as InvoiceRow), invoice_line_items: sorted };
  });

  const rawArtworks = (artworksRes.data ?? []) as Record<string, unknown>[];
  const artworks: OperationsArtworkOption[] = rawArtworks.map((row) => {
    const links = (row.exhibition_artworks as Record<string, unknown>[] | null) ?? [];
    const exById = new Map<string, OperationsExhibitionRef>();
    for (const link of links) {
      const exRaw = link.exhibitions as
        | { id: string; title: string; start_date: string | null }
        | { id: string; title: string; start_date: string | null }[]
        | null
        | undefined;
      const ex = Array.isArray(exRaw) ? exRaw[0] : exRaw;
      if (ex?.id) {
        exById.set(ex.id, {
          id: ex.id,
          title: typeof ex.title === 'string' ? ex.title : 'Exhibition',
          start_date: ex.start_date ?? null,
        });
      }
    }
    return {
      id: row.id as string,
      title: (row.title as string) ?? '',
      artist_name: (row.artist_name as string | null) ?? null,
      exhibitions: [...exById.values()],
    };
  });

  console.log('[Operations] page loaded', {
    loans: loans.length,
    invoices: invoices.length,
    artworks: artworks.length,
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">Operations</h1>
        <p className="text-ink/70 font-serif max-w-3xl">
          Manage artwork loan agreements and professional invoices alongside your collection records.
        </p>
      </div>

      <OperationsPageContent initialLoans={loans} initialInvoices={invoices} artworks={artworks} />
    </div>
  );
}
