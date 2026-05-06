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
  startActorRun,
} from '~/lib/apify';

export const dynamic = 'force-dynamic';

const TERMINAL_STATUSES = new Set([
  'SUCCEEDED',
  'FAILED',
  'TIMED-OUT',
  'ABORTED',
]);

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
    let runStatus: string | null = null;
    let activeRunId: string | null = null;

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
          runId: runIdParam,
          runStatus: null,
          leads: [],
          message: `Could not load that run: ${runRes.message}`,
        });
      }
      activeRunId = runRes.run.id;
      runStatus = runRes.run.status;
      // Only show dataset items once the run has completed successfully.
      if (runRes.run.status === 'SUCCEEDED') {
        datasetId = runRes.run.defaultDatasetId;
      }
    }

    if (!datasetId && !runIdParam) {
      const latestOk = runsResult.items.find(
        (r) => r.status === 'SUCCEEDED' && r.defaultDatasetId,
      );
      datasetId = latestOk?.defaultDatasetId;
      if (latestOk) {
        activeRunId = latestOk.id;
        runStatus = latestOk.status;
      }
    }

    let leads: ReturnType<typeof normalizeLeadRow>[] = [];
    let message: string | null = null;

    if (datasetId) {
      const itemsRes = await getDatasetItems(token, datasetId, { limit: 200 });
      if (!itemsRes.ok) {
        console.error('[API/admin/leads] getDatasetItems failed', itemsRes.message);
        return NextResponse.json(
          { error: itemsRes.message, actorId, runs, datasetId },
          { status: 502 },
        );
      }
      leads = itemsRes.items.map((row) => normalizeLeadRow(row));
      console.log('[API/admin/leads] loaded leads', { count: leads.length, datasetId });
    } else if (runStatus && !TERMINAL_STATUSES.has(runStatus)) {
      message = `Run is ${runStatus.toLowerCase()}. This page will refresh when it finishes.`;
    } else if (runIdParam && runStatus && runStatus !== 'SUCCEEDED') {
      message = `Run ${runStatus.toLowerCase()} — no dataset to show.`;
    } else {
      message =
        'No finished run yet. Start a new search above, or run the Actor in Apify Console and refresh.';
    }

    return NextResponse.json({
      actorId,
      defaultActorId: DEFAULT_LEADS_ACTOR_ID,
      runs,
      runId: activeRunId,
      runStatus,
      datasetId: datasetId ?? null,
      leads,
      message,
    });
  } catch (err) {
    console.error('[API/admin/leads] unexpected error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}

/**
 * Start a new Apify Actor run from the admin UI.
 * Body: { searchTerms: string[]; location?: string; maxResults?: number; language?: string }
 */
export async function POST(request: NextRequest) {
  console.log('[API/admin/leads] POST started');
  const gate = await requireAdminApi();
  if (gate instanceof NextResponse) {
    return gate;
  }

  const token = getApifyToken();
  if (!token) {
    return NextResponse.json(
      { error: 'Apify is not configured. Set APIFY_API_TOKEN in the environment.' },
      { status: 503 },
    );
  }

  let body: {
    searchTerms?: unknown;
    location?: unknown;
    maxResults?: unknown;
    language?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const searchTerms = Array.isArray(body.searchTerms)
    ? body.searchTerms
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter(Boolean)
    : [];
  if (searchTerms.length === 0) {
    return NextResponse.json(
      { error: 'Provide at least one search term (e.g. "art galleries").' },
      { status: 400 },
    );
  }

  const maxResults =
    typeof body.maxResults === 'number' && body.maxResults > 0
      ? Math.min(Math.floor(body.maxResults), 200)
      : 25;

  const location =
    typeof body.location === 'string' && body.location.trim()
      ? body.location.trim()
      : undefined;

  const language =
    typeof body.language === 'string' && body.language.trim()
      ? body.language.trim()
      : 'en';

  const actorId = getLeadsActorId();
  const result = await startActorRun(token, actorId, {
    searchTerms,
    location,
    maxResults,
    language,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, actorId },
      { status: result.status ?? 502 },
    );
  }

  return NextResponse.json({
    actorId,
    runId: result.run.id,
    status: result.run.status,
    datasetId: result.run.defaultDatasetId ?? null,
  });
}
