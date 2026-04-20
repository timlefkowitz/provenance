/* eslint-disable @typescript-eslint/no-explicit-any -- Operations tables not in generated DB types */
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getActiveArtistSubscription } from '~/lib/subscription';
import { buildLoanAgreementPdfBytes } from '~/lib/operations/pdf';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  console.log('[Operations/API] GET loan pdf started', id);

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

    const { data: row, error } = await (client as any)
      .from('artwork_loan_agreements')
      .select(
        `
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
        account_id,
        artwork:artworks(title)
      `,
      )
      .eq('id', id)
      .eq('account_id', user.id)
      .maybeSingle();

    if (error || !row) {
      console.error('[Operations/API] loan pdf not found', error);
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const artwork = row.artwork as { title?: string } | { title?: string }[] | null;
    const title =
      Array.isArray(artwork) ? artwork[0]?.title : (artwork as { title?: string } | null)?.title;

    const pdfBytes = await buildLoanAgreementPdfBytes({
      artworkTitle: title ?? 'Artwork',
      borrowerName: row.borrower_name ?? '',
      borrowerEmail: row.borrower_email,
      lenderName: row.lender_name,
      lenderEmail: row.lender_email,
      startDate: row.start_date,
      endDate: row.end_date,
      termsText: row.terms_text,
      conditionsText: row.conditions_text,
      insuranceText: row.insurance_requirements_text,
      status: row.status,
    });

    const filename = `loan-agreement-${id.slice(0, 8)}.pdf`;
    console.log('[Operations/API] loan pdf success', id);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[Operations/API] loan pdf unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
