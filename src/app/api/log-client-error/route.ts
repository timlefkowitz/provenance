import { NextRequest, NextResponse } from 'next/server';
import { logger } from '~/lib/logger';
import { checkRateLimit } from '~/lib/rate-limit';

function sanitizeClientErrorPayload(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const raw = input as Record<string, unknown>;

  // Known safe fields we expect from the client
  const safeKeys = new Set([
    'message',
    'uploaded',
    'totalImages',
    'userAgent',
    'platform',
    'viewport',
    'chunkCount',
  ]);

  const sanitized: Record<string, unknown> = {
    scope: 'artworks_add',
  };

  for (const [key, value] of Object.entries(raw)) {
    if (!safeKeys.has(key)) {
      continue;
    }

    if (typeof value === 'string') {
      // Truncate very long strings to avoid logging large payloads
      sanitized[key] = value.length > 500 ? `${value.slice(0, 500)}…` : value;
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export async function POST(req: NextRequest) {
  try {
    if (!checkRateLimit(req, { keyPrefix: 'log_client_error', maxPerWindow: 30 })) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const body = await req.json().catch(() => null);

    const data = sanitizeClientErrorPayload(body);

    logger.error('client_error', data);

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

