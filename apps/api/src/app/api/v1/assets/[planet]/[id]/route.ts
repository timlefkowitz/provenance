import { NextResponse } from 'next/server';
import { isValidPlanet } from '@provenance/core/types';
import { authenticateRequest, isAuthError } from '~/middleware/auth';
import { getTableForPlanet } from '~/lib/adapters';
import { getServiceClient } from '~/lib/supabase';
import { badRequest, notFound, serverError } from '~/lib/errors';

/**
 * GET /api/v1/assets/{planet}/{id}
 *
 * Returns the full asset record.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ planet: string; id: string }> },
) {
  const { planet, id } = await params;
  console.log(`[API/assets] GET /api/v1/assets/${planet}/${id}`);

  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  if (!isValidPlanet(planet)) {
    return badRequest(`Invalid planet: ${planet}`);
  }

  try {
    const client = getServiceClient();
    const table = getTableForPlanet(planet);

    const { data: asset, error } = await client
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !asset) {
      return notFound(`Asset ${id} not found in ${planet}`);
    }

    return NextResponse.json(asset);
  } catch (err) {
    return serverError('Failed to fetch asset', err);
  }
}
