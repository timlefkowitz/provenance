import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { createNotification } from '~/lib/notifications';

/**
 * In-app notification to every admin. We treat
 * `accounts.public_data->admin = true` as the source of truth (matches
 * `~/lib/admin.ts`). Best-effort — never throws, so a notification failure
 * never rolls back the caller's write.
 */
export async function notifyAdmins(params: {
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  logTag: string;
}): Promise<void> {
  const { title, message, metadata, logTag } = params;
  try {
    const admin = getSupabaseServerAdminClient();
    const { data: adminAccounts, error } = await asUntyped(admin)
      .from('accounts')
      .select('id, public_data');

    if (error) {
      console.error(`[${logTag}] failed to load admin accounts`, error);
      return;
    }

    const adminIds = (adminAccounts ?? [])
      .filter((row) => (row.public_data as Record<string, unknown> | null)?.admin === true)
      .map((row) => row.id as string);

    console.log(`[${logTag}] notifying admins`, { count: adminIds.length });

    await Promise.all(
      adminIds.map((adminId) =>
        createNotification({
          userId: adminId,
          // Reuses an existing notification type so the badge / list
          // renders without a schema change. metadata.kind discriminates.
          type: 'message',
          title,
          message: message.slice(0, 200),
          metadata,
        }).catch((err) => {
          console.error(`[${logTag}] notify admin failed`, adminId, err);
        }),
      ),
    );
  } catch (err) {
    console.error(`[${logTag}] notifyAdmins threw`, err);
  }
}
