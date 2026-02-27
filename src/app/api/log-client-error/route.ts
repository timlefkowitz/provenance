import { NextRequest, NextResponse } from 'next/server';
import { logger } from '~/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    logger.error('client_error', {
      scope: 'artworks_add',
      ...((body && typeof body === 'object') ? body : {}),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    logger.error('client_error_route_failed', {
      scope: 'artworks_add',
      message: error?.message ?? String(error),
      stack: error?.stack,
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

