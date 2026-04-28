'use server';

import { headers } from 'next/headers';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createNotification } from '~/lib/notifications';
import { checkRateLimit } from '~/lib/rate-limit';

const VALID_CATEGORIES = ['bug', 'idea', 'praise', 'question', 'other'] as const;
type FeedbackCategory = (typeof VALID_CATEGORIES)[number];

export type SubmitFeedbackInput = {
  message: string;
  category?: string;
  subject?: string | null;
  pageUrl?: string | null;
  isAnonymous?: boolean;
};

export type SubmitFeedbackResult =
  | { ok: true; ticketId: string }
  | { ok: false; error: string };

const MAX_MESSAGE = 8000;
const MAX_SUBJECT = 200;

function normalizeCategory(input: unknown): FeedbackCategory {
  if (typeof input !== 'string') return 'other';
  const lower = input.toLowerCase();
  return (VALID_CATEGORIES as readonly string[]).includes(lower)
    ? (lower as FeedbackCategory)
    : 'other';
}

/**
 * Notify all admins. We treat `accounts.public_data->admin = true` as
 * the source of truth (matches `~/lib/admin.ts`). Best-effort — failures
 * to notify do NOT roll back the ticket.
 */
async function notifyAdmins(ticketId: string, summary: string, isAnonymous: boolean) {
  try {
    const admin = getSupabaseServerAdminClient();
    // public_data may not be in the typed columns set for accounts in
    // every environment; cast to any to keep this resilient.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: adminAccounts, error } = await (admin as any)
      .from('accounts')
      .select('id, public_data');

    if (error) {
      console.error('[Feedback] failed to load admin accounts', error);
      return;
    }

    const adminIds = (adminAccounts ?? [])
      .filter((row) => {
        const pd = row.public_data as Record<string, unknown> | null;
        return pd?.admin === true;
      })
      .map((row) => row.id as string);

    console.log('[Feedback] notifying admins', { ticketId, count: adminIds.length });

    await Promise.all(
      adminIds.map((adminId) =>
        createNotification({
          userId: adminId,
          // Reuses an existing notification type so the badge / list
          // renders without a schema change. The metadata.kind discriminator
          // lets us specialize the rendering later.
          type: 'message',
          title: isAnonymous
            ? 'New anonymous feedback'
            : 'New feedback ticket',
          message: summary.slice(0, 200),
          metadata: {
            kind: 'feedback_ticket',
            ticket_id: ticketId,
            href: `/admin/feedback#${ticketId}`,
          },
        }).catch((err) => {
          console.error('[Feedback] notify admin failed', adminId, err);
        }),
      ),
    );
  } catch (err) {
    console.error('[Feedback] notifyAdmins threw', err);
  }
}

export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<SubmitFeedbackResult> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { ok: false, error: 'You must be signed in to submit feedback.' };
  }

  const message = (input.message ?? '').trim();
  if (!message) {
    return { ok: false, error: 'Please write a message before submitting.' };
  }
  if (message.length > MAX_MESSAGE) {
    return { ok: false, error: 'Message is too long (8000 chars max).' };
  }

  const hdrs = await headers();

  // 5 submissions / 10 minutes per user — prevents accidental spam.
  const allowed = checkRateLimit(
    { headers: hdrs },
    {
      keyPrefix: `feedback:${user.id}`,
      maxPerWindow: 5,
      windowMs: 600_000,
    },
  );
  if (!allowed) {
    return {
      ok: false,
      error:
        'You have submitted several tickets recently. Please wait a few minutes and try again.',
    };
  }

  const isAnonymous = Boolean(input.isAnonymous);
  const subject = input.subject?.trim().slice(0, MAX_SUBJECT) || null;
  const category = normalizeCategory(input.category);
  const pageUrl = input.pageUrl?.trim().slice(0, 2000) || null;

  const userAgent = hdrs.get('user-agent')?.slice(0, 500) ?? null;

  // Pull a stable email/name snapshot (helps when admins follow up later
  // and protects against later account deletion). Anonymous tickets
  // explicitly null these out.
  let submitterEmail: string | null = null;
  let submitterName: string | null = null;
  if (!isAnonymous) {
    submitterEmail = user.email ?? null;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    submitterName =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      (typeof meta.display_name === 'string' && meta.display_name) ||
      null;
  }

  const insertPayload = {
    submitted_by: isAnonymous ? null : user.id,
    is_anonymous: isAnonymous,
    submitter_email: submitterEmail,
    submitter_name: submitterName,
    category,
    subject,
    message,
    page_url: pageUrl,
    user_agent: userAgent,
  };

  // Anonymous inserts must go through the service-role client because
  // RLS pins `submitted_by` to auth.uid() for non-anonymous rows AND
  // requires `submitted_by IS NULL` for anonymous rows. The user-scoped
  // client cannot satisfy both clauses for anonymous submissions.
  const writer = isAnonymous
    ? getSupabaseServerAdminClient()
    : client;

  // feedback_tickets is not yet present in the generated Database types
  // (added in scripts/2026-04-27_feedback_and_presence.sql).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (writer as any)
    .from('feedback_tickets')
    .insert(insertPayload)
    .select('id, message')
    .single();

  if (error || !data) {
    console.error('[Feedback] insert failed', error);
    return { ok: false, error: 'Could not save your feedback. Please try again.' };
  }

  await notifyAdmins(data.id as string, message, isAnonymous);

  return { ok: true, ticketId: data.id as string };
}
