import { NextResponse } from 'next/server';
import { isValidPlanet } from '@provenance/core/types';
import { authenticateRequest, isAuthError } from '~/middleware/auth';
import { getTableForPlanet } from '~/lib/adapters';
import { getServiceClient } from '~/lib/supabase';
import { badRequest, serverError } from '~/lib/errors';

/**
 * POST /api/v1/assets/{planet}
 *
 * Creates a new asset in the specified planet (vertical).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ planet: string }> },
) {
  const { planet } = await params;
  console.log(`[API/assets] POST /api/v1/assets/${planet} started`);

  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  if (!isValidPlanet(planet)) {
    return badRequest(`Invalid planet: ${planet}`);
  }

  if (auth.planet && auth.planet !== planet) {
    return badRequest(`API key is scoped to planet "${auth.planet}"`);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.title || typeof body.title !== 'string') {
    return badRequest('title is required');
  }

  try {
    const client = getServiceClient();
    const table = getTableForPlanet(planet);

    const { data: certResult } = await client.rpc('generate_certificate_number');
    const certificateNumber = certResult ?? `PROV-${Date.now()}`;

    const insertData = {
      ...body,
      account_id: auth.accountId,
      certificate_number: certificateNumber,
      certificate_status: 'pending',
      status: 'draft',
      created_by: auth.accountId,
      updated_by: auth.accountId,
    };

    const { data: asset, error } = await client
      .from(table)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error(`[API/assets] Insert into ${table} failed`, error);
      return serverError(`Failed to create asset: ${error.message}`);
    }

    await client.from('asset_events').insert({
      planet,
      asset_id: asset.id,
      event_type: 'CREATED',
      actor_id: auth.accountId,
      payload: { source: 'api', api_key_id: auth.keyId },
    });

    console.log(`[API/assets] Asset created in ${planet}`, { id: asset.id });

    return NextResponse.json(asset, { status: 201 });
  } catch (err) {
    return serverError('Failed to create asset', err);
  }
}
