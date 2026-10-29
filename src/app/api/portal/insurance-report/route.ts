import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

import { buildInsuranceReportPdfBytes, type InsuranceScheduleItem } from '~/lib/collectors/insurance-report-pdf';
import { loadCollectionBreakdown } from '~/lib/portal-graphs/load-breakdown-rows';
import type { ValueResult } from '~/lib/portal-graphs/value-waterfall';

export const dynamic = 'force-dynamic';

function formatShortDate(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
}

function basisLabel(value: ValueResult): string {
  switch (value.source) {
    case 'formal_valuation': {
      const when = formatShortDate(value.details.valuationGeneratedAt);
      return when ? `Formal valuation, ${when}` : 'Formal valuation';
    }
    case 'sale_price': {
      const when = formatShortDate(value.details.saleDate);
      return when ? `Sale price, ${when}` : 'Sale price';
    }
    case 'declared_value':
      return 'Declared by owner';
    default:
      return 'No value on record';
  }
}

/** Signed-in collector's own insurance schedule for the works they currently own. */
export async function GET() {
  console.log('[Portal/API] insurance report started');

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await loadCollectionBreakdown(user.id);
    const admin = asUntyped(getSupabaseServerAdminClient());

    const [{ data: details }, { data: account }] = await Promise.all([
      rows.length
        ? admin
            .from('artworks')
            .select('id, medium, dimensions, creation_date, certificate_number')
            .in('id', rows.map((r) => r.artwork_id))
        : { data: [] },
      admin.from('accounts').select('name, email').eq('id', user.id).maybeSingle(),
    ]);
    const detailById = new Map(
      ((details ?? []) as Array<{
        id: string;
        medium: string | null;
        dimensions: string | null;
        creation_date: string | null;
        certificate_number: string | null;
      }>).map((d) => [d.id, d]),
    );

    const items: InsuranceScheduleItem[] = rows.map((row) => {
      const d = detailById.get(row.artwork_id);
      return {
        title: row.title,
        artistName: row.artist_name,
        medium: d?.medium ?? null,
        dimensions: d?.dimensions ?? null,
        creationDate: d?.creation_date ?? null,
        certificateNumber: d?.certificate_number ?? null,
        valueCents: row.current_value.value_cents,
        basis: basisLabel(row.current_value),
        paidCents: row.paid_cents ?? null,
      };
    });

    const generatedAt = new Date();
    const bytes = await buildInsuranceReportPdfBytes({
      ownerName: account?.name || account?.email || 'Collection',
      generatedAt,
      items,
    });

    console.log('[Portal/API] insurance report built', { userId: user.id, works: items.length });
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="collection-schedule-${generatedAt.toISOString().slice(0, 10)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[Portal/API] insurance report failed', err);
    return NextResponse.json({ error: 'Could not build the report' }, { status: 500 });
  }
}
