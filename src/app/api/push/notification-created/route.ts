import { NextResponse, type NextRequest } from 'next/server';
import { sendNotificationPush } from '~/lib/push/send-notification-push';
import { constantTimeEquals } from '~/lib/security/constant-time';

export const runtime = 'nodejs';

function isAuthorized(request: NextRequest) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Push] PUSH_WEBHOOK_SECRET is not set');
    return false;
  }
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return false;
  }
  return constantTimeEquals(header.slice(7), secret);
}

/**
 * Called by the notifications_push_after_insert trigger (pg_net) for every
 * new notification whose user has a registered iOS device.
 * Body: { notificationId: string }. Auth: Bearer $PUSH_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { notificationId?: unknown };
  if (typeof body.notificationId !== 'string' || !body.notificationId) {
    return NextResponse.json({ error: 'notificationId required' }, { status: 400 });
  }

  const result = await sendNotificationPush(body.notificationId);
  return NextResponse.json(result);
}
