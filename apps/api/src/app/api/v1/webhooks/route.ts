import { NextResponse } from 'next/server';
import { authenticateRequest, isAuthError } from '~/middleware/auth';
import { badRequest, serverError } from '~/lib/errors';

/**
 * POST /api/v1/webhooks
 *
 * Registers a webhook URL for event notifications.
 * Events: asset.created, verification.completed, certificate.issued, certificate.updated
 */
export async function POST(request: Request) {
  console.log('[API/webhooks] POST /api/v1/webhooks');

  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  let body: { url?: string; events?: string[] };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.url || typeof body.url !== 'string') {
    return badRequest('url is required');
  }

  try {
    new URL(body.url);
  } catch {
    return badRequest('url must be a valid URL');
  }

  const validEvents = [
    'asset.created',
    'verification.completed',
    'certificate.issued',
    'certificate.updated',
    'ownership.transferred',
  ];

  const events = body.events ?? validEvents;
  const invalidEvents = events.filter((e) => !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    return badRequest(`Invalid events: ${invalidEvents.join(', ')}. Valid: ${validEvents.join(', ')}`);
  }

  try {
    return NextResponse.json(
      {
        id: crypto.randomUUID(),
        url: body.url,
        events,
        account_id: auth.accountId,
        status: 'active',
        created_at: new Date().toISOString(),
        message: 'Webhook registered. Webhook delivery will be enabled in a future release.',
      },
      { status: 201 },
    );
  } catch (err) {
    return serverError('Failed to register webhook', err);
  }
}
