import { NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '~/lib/admin';
import {
  DEFAULT_LEADS_ACTOR_ID,
  getActorRun,
  getApifyToken,
  getDatasetItems,
  getLeadsActorId,
  listActorRuns,
  normalizeLeadRow,
} from '~/lib/apify';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('[API/admin/leads] GET started');
  const gate = await requireAdminApi();
  if (gate instanceof NextResponse) {
    return gate;
  }

  const token = getApifyToken();
  if (!token) {
    console.error('[API/admin/leads] APIFY_API_TOKEN not configured');
    return NextResponse.json(
      { error: 'Apify is not configured. Set APIFY_API_TOKEN in the environment.' },
      { status: 503 },
    );
  }

  const actorId = getLeadsActorId();
  const { searchParams } = request.nextUrl;
  const datasetIdParam = searchParams.get('datasetId');
  const runIdParam = searchParams.get('runId');

  try {
    let datasetId: string | undefined = datasetIdParam ?? undefined;

    const runsResult = await listActorRuns(token, actorId, { limit: 20 });
    if (!runsResult.ok) {
      console.error('[API/admin/leads] listActorRuns failed', runsResult.message);
      return NextResponse.json(
        { error: runsResult.message, actorId },
        { status: 502 },
      );
    }

    const runs = runsResult.items.map((r) => ({
      id: r.id,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      defaultDatasetId: r.defaultDatasetId,
    }));

    if (runIdParam) {
      const runRes = await getActorRun(token, runIdParam);
      if (!runRes.ok) {
        console.error('[API/admin/leads] getActorRun failed', runRes.message);
        return NextResponse.json({
          actorId,
          defaultActorId: DEFAULT_LEADS_ACTOR_ID,
          runs,
          datasetId: null,
          leads: [],
          message: `Could not load that run: ${runRes.message}`,
        });
      }
      datasetId = runRes.run.defaultDatasetId;
    }

    if (!datasetId) {
      const latestOk = runsResult.items.find(
        (r) => r.status === 'SUCCEEDED' && r.defaultDatasetId,
      );
      datasetId = latestOk?.defaultDatasetId;
    }

    let leads: ReturnType<typeof normalizeLeadRow>[] = [];
    let message: string | undefined;

    if (datasetId) {
      const itemsRes = await getDatasetItems(token, datasetId, { limit: 100 });
      if (!itemsRes.ok) {
        console.error('[API/admin/leads] getDatasetItems failed', itemsRes.message);
        return NextResponse.json(
          { error: itemsRes.message, actorId, runs, datasetId },
          { status: 502 },
        );
      }
      leads = itemsRes.items.map((row) => normalizeLeadRow(row));
      console.log('[API/admin/leads] loaded leads', { count: leads.length, datasetId });
    } else {
      message =
        'No finished run with a dataset yet. Open Apify Console, run your leads Actor (e.g. Google Places for galleries), then refresh.';
      console.log('[API/admin/leads] no dataset for actor', { actorId });
    }

    return NextResponse.json({
      actorId,
      defaultActorId: DEFAULT_LEADS_ACTOR_ID,
      runs,
      datasetId: datasetId ?? null,
      leads,
      message: message ?? null,
    });
  } catch (err) {
    console.error('[API/admin/leads] unexpected error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
