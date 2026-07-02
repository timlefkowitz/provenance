import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import type { LeadEmailQuality } from '~/lib/lead-email-quality';

export const INVITE_OUTREACH_TEMPLATE_KEY = 'invite';

export async function fetchAlreadyInvitedEmails(
  emails: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (emails.length === 0) return map;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseServerAdminClient() as any;
  const { data, error } = await admin
    .from('admin_outreach_sends')
    .select('email, created_at')
    .eq('template_key', INVITE_OUTREACH_TEMPLATE_KEY)
    .eq('status', 'sent')
    .in(
      'email',
      emails.map((e) => e.toLowerCase()),
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[AdminOutreach] fetchAlreadyInvitedEmails failed', error);
    throw new Error('Could not check prior invite sends.');
  }

  for (const row of data ?? []) {
    const key = String(row.email).toLowerCase();
    if (!map.has(key)) {
      map.set(key, row.created_at as string);
    }
  }

  return map;
}

export async function logAdminOutreachSend(input: {
  email: string;
  templateKey?: string;
  status: 'sent' | 'failed' | 'skipped';
  skipReason?: string;
  quality?: LeadEmailQuality;
  errorMessage?: string;
  sentBy: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getSupabaseServerAdminClient() as any;
  const { error } = await admin.from('admin_outreach_sends').insert({
    email: input.email.toLowerCase(),
    template_key: input.templateKey ?? INVITE_OUTREACH_TEMPLATE_KEY,
    status: input.status,
    skip_reason: input.skipReason ?? null,
    quality: input.quality ?? null,
    error_message: input.errorMessage ?? null,
    sent_by: input.sentBy,
  });

  if (error) {
    console.error('[AdminOutreach] logAdminOutreachSend failed', error, input.email);
  }
}
