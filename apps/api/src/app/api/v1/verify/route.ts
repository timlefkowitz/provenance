import { NextResponse } from 'next/server';
import { isValidPlanet, type Planet } from '@provenance/core/types';
import { authenticateRequest, isAuthError } from '~/middleware/auth';
import { getVerificationAdapter, getTableForPlanet } from '~/lib/adapters';
import { getServiceClient } from '~/lib/supabase';
import { badRequest, notFound, serverError } from '~/lib/errors';

function metadataKeyForPlanet(planet: Planet): string {
  if (planet === 'realestate') return 'property';
  if (planet === 'artworks') return 'artwork';
  if (planet === 'collectibles') return 'collectible';
  return 'vehicle';
}

/**
 * POST /api/v1/verify
 *
 * Body: { planet: string, asset_id: string } (legacy: `island` is accepted as alias for `planet`)
 * Returns: VerificationResult
 */
export async function POST(request: Request) {
  console.log('[API/verify] POST /api/v1/verify started');

  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  let body: { planet?: string; island?: string; asset_id?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const planetRaw = body.planet ?? body.island;
  const { asset_id } = body;

  if (!planetRaw || !isValidPlanet(planetRaw)) {
    return badRequest(`Invalid planet. Must be one of: artworks, collectibles, realestate, vehicles`);
  }

  const planet = planetRaw;

  if (!asset_id) {
    return badRequest('asset_id is required');
  }

  if (auth.planet && auth.planet !== planet) {
    return badRequest(`API key is scoped to planet "${auth.planet}" but request targets "${planet}"`);
  }

  try {
    const client = getServiceClient();
    const table = getTableForPlanet(planet);

    const { data: asset, error } = await client
      .from(table)
      .select('*')
      .eq('id', asset_id)
      .single();

    if (error || !asset) {
      return notFound(`Asset not found in ${planet}`);
    }

    const adapter = getVerificationAdapter(planet);
    const metaKey = metadataKeyForPlanet(planet);
    const result = await adapter.verify({
      planet,
      asset_id,
      metadata: { [metaKey]: asset },
    });

    await client.from('asset_events').insert({
      planet,
      asset_id,
      event_type: 'VERIFIED',
      actor_id: auth.accountId,
      payload: {
        confidence: result.confidence,
        verified: result.verified,
        risk_flags: result.risk_flags.map(f => f.code),
        api_key_id: auth.keyId,
      },
    });

    console.log('[API/verify] Verification completed', { planet, asset_id, confidence: result.confidence });

    return NextResponse.json(result);
  } catch (err) {
    return serverError('Verification failed', err);
  }
}
