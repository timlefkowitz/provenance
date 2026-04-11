import { NextResponse } from 'next/server';
import { isValidPlanet } from '@provenance/core/types';
import { authenticateRequest, isAuthError } from '~/middleware/auth';
import { getServiceClient } from '~/lib/supabase';
import { badRequest, serverError } from '~/lib/errors';

/**
 * GET /api/v1/assets/{planet}/{id}/history
 *
 * Returns the full event history for an asset.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ planet: string; id: string }> },
) {
  const { planet, id } = await params;
  console.log(`[API/assets] GET /api/v1/assets/${planet}/${id}/history`);

  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  if (!isValidPlanet(planet)) {
    return badRequest(`Invalid planet: ${planet}`);
  }

  try {
    const client = getServiceClient();

    const { data: events, error } = await client
      .from('asset_events')
      .select('*')
      .eq('planet', planet)
      .eq('asset_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[API/assets] Failed to fetch event history', error);
      return serverError('Failed to fetch event history');
    }

    return NextResponse.json({
      asset_id: id,
      planet,
      events: events ?? [],
      total: events?.length ?? 0,
    });
  } catch (err) {
    return serverError('Failed to fetch event history', err);
  }
}
