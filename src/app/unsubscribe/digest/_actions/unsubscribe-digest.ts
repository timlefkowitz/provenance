'use server';

import { redirect } from 'next/navigation';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { setDigestOptOut, verifyUnsubscribeToken } from '~/lib/email-preferences';
import { asUntyped } from '~/lib/supabase-untyped';

/** Records the opt-out for the user named by a signed token, then shows the result. */
export async function unsubscribeDigest(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const userId = verifyUnsubscribeToken(token);
  if (!userId) redirect('/unsubscribe/digest?status=invalid');

  const result = await setDigestOptOut(asUntyped(getSupabaseServerAdminClient()), userId, true);
  console.log('[Unsubscribe] digest opt-out', { userId, ok: result.ok });
  redirect(`/unsubscribe/digest?status=${result.ok ? 'done' : 'error'}`);
}
