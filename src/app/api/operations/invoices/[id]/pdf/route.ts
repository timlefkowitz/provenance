/* eslint-disable @typescript-eslint/no-explicit-any -- Operations tables not in generated DB types */
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getActiveArtistSubscription } from '~/lib/subscription';
import { buildInvoicePdfBytes } from '~/lib/operations/pdf';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  console.log('[Operations/API] GET invoice pdf started', id);

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sub = await getActiveArtistSubscription(user.id);
    if (!sub) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    const { data: inv, error: invErr } = await (client as any)
      .from('invoices')
      .select(
        'id, invoice_number, client_name, client_email, status, currency, due_date, tax_cents, notes, account_id',
      )
      .eq('id', id)
      .eq('account_id', user.id)
      .maybeSingle();

    if (invErr || !inv) {
      console.error('[Operations/API] invoice pdf invoice not found', invErr);
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: lines, error: lineErr } = await (client as any)
      .from('invoice_line_items')
      .select('description, quantity, unit_amount_cents')
      .eq('invoice_id', id)
      .order('sort_order', { ascending: true });

    if (lineErr) {
      console.error('[Operations/API] invoice pdf lines failed', lineErr);
      return NextResponse.json({ error: 'Failed to load lines' }, { status: 500 });
    }

    const pdfBytes = await buildInvoicePdfBytes({
      invoiceNumber: inv.invoice_number,
      clientName: inv.client_name,
      clientEmail: inv.client_email,
      status: inv.status,
      currency: inv.currency,
      dueDate: inv.due_date,
      notes: inv.notes,
      taxCents: inv.tax_cents ?? 0,
      lines: (lines ?? []).map((l: any) => ({
        description: l.description ?? '',
        quantity: Number(l.quantity),
        unitAmountCents: l.unit_amount_cents,
      })),
    });

    const filename = `invoice-${inv.invoice_number}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
    console.log('[Operations/API] invoice pdf success', id);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[Operations/API] invoice pdf unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
