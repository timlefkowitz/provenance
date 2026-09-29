import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import {
  isDeadTokenResult,
  isWrongEnvironmentResult,
  sendApns,
  type ApnsEnvironment,
  type ApnsPayload,
} from './apns';

type PushDevice = { token: string; environment: ApnsEnvironment };

const OTHER_ENVIRONMENT: Record<ApnsEnvironment, ApnsEnvironment> = {
  production: 'sandbox',
  sandbox: 'production',
};

/**
 * Pushes one in-app notification (public.notifications row) to every iOS
 * device registered to its user. Called by the notifications insert trigger
 * via /api/push/notification-created.
 */
export async function sendNotificationPush(notificationId: string): Promise<{ sent: number; failed: number }> {
  const admin = asUntyped(getSupabaseServerAdminClient());

  const { data: notification, error: nErr } = await admin
    .from('notifications')
    .select('id, user_id, title, message, read')
    .eq('id', notificationId)
    .maybeSingle();
  if (nErr || !notification) {
    console.error('[Push] notification not found', { notificationId, error: nErr });
    return { sent: 0, failed: 0 };
  }
  if (notification.read) return { sent: 0, failed: 0 };

  const { data: devices, error: dErr } = await admin
    .from('push_devices')
    .select('token, environment')
    .eq('user_id', notification.user_id);
  if (dErr) {
    console.error('[Push] device lookup failed', { userId: notification.user_id, error: dErr });
    return { sent: 0, failed: 0 };
  }
  if (!devices?.length) return { sent: 0, failed: 0 };

  const payload: ApnsPayload = {
    title: notification.title,
    body: notification.message ? String(notification.message).slice(0, 240) : undefined,
    path: '/notifications',
  };

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];
  const moved: PushDevice[] = [];

  for (const environment of ['production', 'sandbox'] as const) {
    const group = (devices as PushDevice[]).filter((d) => d.environment === environment);
    if (!group.length) continue;

    const results = await sendApns(environment, group.map((d) => d.token), payload);
    const retry: string[] = [];
    results.forEach((result, i) => {
      const token = group[i]!.token;
      if (result.ok) sent++;
      else if (isDeadTokenResult(result)) dead.push(token);
      else if (isWrongEnvironmentResult(result)) retry.push(token);
      else {
        failed++;
        console.error('[Push] APNs send failed', { environment, status: result.status, reason: result.reason });
      }
    });

    // Development builds hand out sandbox tokens; learn the right host once.
    if (retry.length) {
      const other = OTHER_ENVIRONMENT[environment];
      const retried = await sendApns(other, retry, payload);
      retried.forEach((result, i) => {
        const token = retry[i]!;
        if (result.ok) {
          sent++;
          moved.push({ token, environment: other });
        } else {
          dead.push(token);
        }
      });
    }
  }

  if (dead.length) {
    const { error } = await admin.from('push_devices').delete().in('token', dead);
    if (error) console.error('[Push] failed to remove dead tokens', { count: dead.length, error });
    else console.log('[Push] removed dead tokens', { count: dead.length });
  }
  for (const device of moved) {
    await admin.from('push_devices').update({ environment: device.environment }).eq('token', device.token);
  }

  console.log('[Push] notification pushed', { notificationId, sent, failed, dead: dead.length });
  return { sent, failed };
}
