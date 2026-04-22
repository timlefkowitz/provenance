/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getActiveSubscription } from '~/lib/subscription';
import { buildConsignmentPdfBytes } from '~/lib/operations/pdf';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  console.log('[Operations/API] GET consignment pdf started', id);

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sub = await getActiveSubscription(user.id);
    if (!sub) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    const { data: row, error } = await (client as any)
      .from('consignments')
      .select(
        `
        consignee_name,
        consignee_email,
        start_date,
        end_date,
        commission_rate_bps,
        reserve_price_cents,
        status,
        terms_text,
        notes,
        account_id,
        artwork:artworks(title)
      `,
      )
      .eq('id', id)
      .eq('account_id', user.id)
      .maybeSingle();

    if (error || !row) {
      console.error('[Operations/API] consignment pdf not found', error);
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const artwork = row.artwork as { title?: string } | { title?: string }[] | null;
    const title =
      Array.isArray(artwork) ? artwork[0]?.title : (artwork as { title?: string } | null)?.title;

    const pdfBytes = await buildConsignmentPdfBytes({
      artworkTitle: title ?? 'Artwork',
      consigneeName: row.consignee_name ?? '',
      consigneeEmail: row.consignee_email,
      startDate: row.start_date,
      endDate: row.end_date,
      commissionRateBps: row.commission_rate_bps,
      reservePriceCents: row.reserve_price_cents,
      status: row.status,
      termsText: row.terms_text,
      notes: row.notes,
    });

    const filename = `consignment-${id.slice(0, 8)}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[Operations/API] consignment pdf unexpected', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
