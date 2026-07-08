import { NextResponse } from 'next/server';
import { isValidPlanet } from '@provenance/core/types';
import { authenticateRequest, isAuthError, requireScope, requirePlanet } from '~/middleware/auth';
import { getTableForPlanet } from '~/lib/adapters';
import { getServiceClient } from '~/lib/supabase';
import { badRequest, notFound, serverError } from '~/lib/errors';

// Public columns returned for asset lookups — avoids exposing internal fields.
const PUBLIC_ASSET_COLS =
  'id, title, artist_name, medium, creation_date, certificate_number, certificate_type, status, is_public, image_url, account_id, created_at, updated_at';

/**
 * GET /api/v1/assets/{planet}/{id}
 *
 * Returns the public asset record.
 * Requires the `verify` scope and matching planet scoping.
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

  const scopeError = requireScope(auth, 'verify');
  if (scopeError) return scopeError;

  const planetError = requirePlanet(auth, planet);
  if (planetError) return planetError;

  try {
    const client = getServiceClient();
    const table = getTableForPlanet(planet);

    const { data: asset, error } = await client
      .from(table)
      .select(PUBLIC_ASSET_COLS)
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
