'use server';

import { isEmailConfigured } from '~/lib/email';

/**
 * Whether transactional email (Resend) is configured — used to warn in Send dialogs.
 */
export async function getEmailConfigStatus(): Promise<{ configured: boolean }> {
  console.log('[Collection] getEmailConfigStatus', { configured: isEmailConfigured() });
  return { configured: isEmailConfigured() };
}
