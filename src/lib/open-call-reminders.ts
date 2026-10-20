import 'server-only';

import { normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

/** Invite statuses that mean the artist is on the list but hasn't submitted. */
const OPEN_STATUSES = ['pending', 'sent'];

/** How far ahead of the deadline the automatic reminder goes out. */
export const DEADLINE_REMINDER_DAYS = 3;

export type OpenCallReminderKind = 'joined' | 'reminder' | 'deadline';

function formatDeadline(closingDate: string): string {
  return new Date(`${closingDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function closesIn(closingDate: string | null): string {
  if (!closingDate) return 'closes soon';
  const days = Math.round(
    (Date.parse(`${closingDate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${isoDate(0)}T00:00:00Z`)) /
      (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return 'closes today';
  if (days === 1) return 'closes tomorrow';
  return `closes in ${days} days`;
}

function deadlineSentence(closingDate: string | null): string {
  return closingDate ? ` Submissions close ${formatDeadline(closingDate)}.` : '';
}

/**
 * In-app (and push) notification linking back to the open call page, where
 * "Submit your work" reopens the upload form with a fresh link.
 */
export async function notifyOpenCallArtists(
  adminClient: UntypedSupabaseClient,
  userIds: string[],
  params: {
    exhibitionId: string;
    exhibitionTitle: string;
    slug: string;
    closingDate: string | null;
    kind: OpenCallReminderKind;
  },
): Promise<number> {
  if (!userIds.length) return 0;
  const after = 'Upload new work or choose pieces already on your account.';
  let title: string;
  let message: string;
  switch (params.kind) {
    case 'joined':
      title = `Your submission to "${params.exhibitionTitle}" is started`;
      message = `Come back any time from the open call page to upload new work or choose pieces already on your account.${deadlineSentence(params.closingDate)}`;
      break;
    case 'reminder':
      title = `Finish your submission to "${params.exhibitionTitle}"`;
      message = `You haven't submitted any work yet.${deadlineSentence(params.closingDate)} ${after}`;
      break;
    case 'deadline':
      title = `"${params.exhibitionTitle}" ${closesIn(params.closingDate)}`;
      message = `You haven't submitted any work yet.${deadlineSentence(params.closingDate)} ${after}`;
      break;
  }

  const { error } = await adminClient.from('notifications').insert(
    userIds.map((userId) => ({
      user_id: userId,
      type: 'open_call_submission_reminder',
      title,
      message,
      metadata: {
        exhibition_id: params.exhibitionId,
        open_call_slug: params.slug,
        kind: params.kind,
      },
    })),
  );
  if (error) {
    console.error('[OpenCallReminders] notify failed', { exhibitionId: params.exhibitionId, error });
    return 0;
  }
  return userIds.length;
}

/**
 * Account ids of artists on the exhibition's list (open-call joiners and
 * invited artists) who haven't submitted anything yet. Null on a load error.
 */
export async function getOpenCallArtistsAwaitingSubmission(
  adminClient: UntypedSupabaseClient,
  params: { exhibitionId: string; galleryId: string },
): Promise<Set<string> | null> {
  const { data: invites, error } = await adminClient
    .from('exhibition_artist_invites')
    .select('artist_account_id, invitee_email')
    .eq('exhibition_id', params.exhibitionId)
    .in('status', OPEN_STATUSES)
    .eq('submitted_count', 0);
  if (error) {
    console.error('[OpenCallReminders] invites load failed', { exhibitionId: params.exhibitionId, error });
    return null;
  }
  const rows = (invites ?? []) as Array<{ artist_account_id: string | null; invitee_email: string }>;

  // Direct invites may predate the artist's account; match those by email.
  const recipients = new Set(
    rows.map((r) => r.artist_account_id).filter((id): id is string => Boolean(id)),
  );
  const emails = rows
    .filter((r) => !r.artist_account_id)
    .map((r) => normalizeInviteEmail(r.invitee_email));
  if (emails.length) {
    const { data: accounts } = await adminClient.from('accounts').select('id').in('email', emails);
    for (const a of (accounts ?? []) as Array<{ id: string }>) recipients.add(a.id);
  }
  recipients.delete(params.galleryId);
  return recipients;
}

/** Which of these artists already got a reminder of these kinds for the exhibition. */
export async function getRemindedArtists(
  adminClient: UntypedSupabaseClient,
  params: {
    exhibitionId: string;
    userIds: string[];
    kinds: OpenCallReminderKind[];
    since?: string;
  },
): Promise<Set<string>> {
  if (!params.userIds.length) return new Set();
  let query = adminClient
    .from('notifications')
    .select('user_id')
    .eq('type', 'open_call_submission_reminder')
    .contains('metadata', { exhibition_id: params.exhibitionId })
    .in('metadata->>kind', params.kinds)
    .in('user_id', params.userIds);
  if (params.since) query = query.gte('created_at', params.since);
  const { data, error } = await query;
  if (error) {
    console.error('[OpenCallReminders] reminded lookup failed', { exhibitionId: params.exhibitionId, error });
  }
  return new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Daily: for every exhibition open call closing within DEADLINE_REMINDER_DAYS,
 * reminds artists on the list who haven't submitted. Each artist gets this
 * reminder at most once per call, so a missed cron day still catches up.
 */
export async function sendOpenCallDeadlineReminders(
  adminClient: UntypedSupabaseClient,
): Promise<{ calls: number; reminded: number }> {
  const { data: calls, error } = await adminClient
    .from('open_calls')
    .select('slug, exhibition_id, submission_closing_date')
    .eq('submission_mode', 'exhibition')
    .not('exhibition_id', 'is', null)
    .gte('submission_closing_date', isoDate(0))
    .lte('submission_closing_date', isoDate(DEADLINE_REMINDER_DAYS));
  if (error) {
    console.error('[OpenCallReminders] open calls load failed', error);
    return { calls: 0, reminded: 0 };
  }

  let reminded = 0;
  const rows = (calls ?? []) as Array<{
    slug: string;
    exhibition_id: string;
    submission_closing_date: string;
  }>;
  for (const call of rows) {
    const { data: exhibition } = await adminClient
      .from('exhibitions')
      .select('id, title, gallery_id')
      .eq('id', call.exhibition_id)
      .maybeSingle();
    if (!exhibition) continue;

    const recipients = await getOpenCallArtistsAwaitingSubmission(adminClient, {
      exhibitionId: exhibition.id,
      galleryId: exhibition.gallery_id,
    });
    if (!recipients?.size) continue;

    const already = await getRemindedArtists(adminClient, {
      exhibitionId: exhibition.id,
      userIds: [...recipients],
      kinds: ['deadline'],
    });
    const toRemind = [...recipients].filter((id) => !already.has(id));

    reminded += await notifyOpenCallArtists(adminClient, toRemind, {
      exhibitionId: exhibition.id,
      exhibitionTitle: exhibition.title,
      slug: call.slug,
      closingDate: call.submission_closing_date,
      kind: 'deadline',
    });
  }

  return { calls: rows.length, reminded };
}
