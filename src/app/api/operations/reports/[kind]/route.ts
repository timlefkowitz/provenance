import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { reportToCsv } from '~/lib/operations/reports/build-reports';
import { loadReport, REPORT_KINDS, type ReportKind } from '~/lib/operations/reports/load-report';
import { buildReportPdfBytes } from '~/lib/operations/reports/report-pdf';
import { getActiveSubscription } from '~/lib/subscription';
import { asUntyped } from '~/lib/supabase-untyped';

/**
 * GET /api/operations/reports/{annual|insurance|acquisitions}?format=pdf|csv&year=2026
 * The signed-in account's own report (Operations data is per account).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params;
  if (!REPORT_KINDS.includes(kind as ReportKind)) {
    return NextResponse.json({ error: 'Unknown report' }, { status: 404 });
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await getActiveSubscription(user.id))) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const format = params.get('format') === 'csv' ? 'csv' : 'pdf';
  const yearParam = Number(params.get('year'));
  const year = Number.isInteger(yearParam) && yearParam > 1900 && yearParam < 3000 ? yearParam : null;

  try {
    const report = await loadReport(asUntyped(getSupabaseServerAdminClient()), kind as ReportKind, user.id, year);
    const filename = `${kind}-report${year ? `-${year}` : ''}.${format}`;
    if (format === 'csv') {
      return new NextResponse(reportToCsv(report), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
    const bytes = await buildReportPdfBytes(report);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[Reports] build failed', { kind, err });
    return NextResponse.json({ error: 'Could not build the report' }, { status: 500 });
  }
}
