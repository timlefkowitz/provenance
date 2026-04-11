import { NextResponse } from 'next/server';
import { authenticateRequest, isAuthError } from '~/middleware/auth';
import { getServiceClient } from '~/lib/supabase';
import { getTableForPlanet } from '~/lib/adapters';
import { isValidPlanet } from '@provenance/core/types';
import { notFound, serverError } from '~/lib/errors';

/**
 * GET /api/v1/certificates/{number}
 *
 * Looks up a certificate by its globally unique number.
 * Searches across all planets — no planet parameter needed.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number: certNumber } = await params;
  console.log(`[API/certificates] GET /api/v1/certificates/${certNumber}`);

  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const client = getServiceClient();

    const { data: cert, error: certError } = await client
      .from('certificates')
      .select('*')
      .eq('certificate_number', certNumber)
      .single();

    if (cert && !certError) {
      let asset = null;
      if (isValidPlanet(cert.planet)) {
        const table = getTableForPlanet(cert.planet);
        const { data } = await client
          .from(table)
          .select('id, title, image_url, status, certificate_status')
          .eq('id', cert.asset_id)
          .single();
        asset = data;
      }

      return NextResponse.json({ certificate: cert, asset });
    }

    const tables = ['artworks', 'collectibles', 'vehicles', 'properties'] as const;
    const planetMap: Record<string, string> = {
      artworks: 'artworks',
      collectibles: 'collectibles',
      vehicles: 'vehicles',
      properties: 'realestate',
    };

    for (const table of tables) {
      const { data: asset } = await client
        .from(table)
        .select('id, title, image_url, status, certificate_number, certificate_status')
        .eq('certificate_number', certNumber)
        .single();

      if (asset) {
        return NextResponse.json({
          certificate: {
            certificate_number: certNumber,
            planet: planetMap[table],
            asset_id: asset.id,
            status: asset.certificate_status ?? 'unknown',
          },
          asset,
        });
      }
    }

    return notFound(`Certificate ${certNumber} not found`);
  } catch (err) {
    return serverError('Failed to look up certificate', err);
  }
}
