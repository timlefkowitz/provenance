'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { isAdmin } from '~/lib/admin';

export type FeedbackTicketStatus = 'open' | 'reviewing' | 'resolved' | 'archived';

export type AdminFeedbackTicket = {
  id: string;
  submitted_by: string | null;
  is_anonymous: boolean;
  submitter_email: string | null;
  submitter_name: string | null;
  category: string;
  subject: string | null;
  message: string;
  page_url: string | null;
  user_agent: string | null;
  status: FeedbackTicketStatus;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FeedbackStatusCounts = Record<FeedbackTicketStatus, number> & {
  total: number;
};

async function requireAdminUserId(): Promise<string | null> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const ok = await isAdmin(user.id);
  return ok ? user.id : null;
}

export async function listFeedbackTickets(
  filter: FeedbackTicketStatus | 'all' = 'all',
): Promise<
  | { ok: true; tickets: AdminFeedbackTicket[]; counts: FeedbackStatusCounts }
  | { ok: false; error: string }
> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  const admin = getSupabaseServerAdminClient();

  // feedback_tickets is not yet present in the generated Database types
  // (added in scripts/2026-04-27_feedback_and_presence.sql).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = (admin as any)
    .from('feedback_tickets')
    .select(
      'id, submitted_by, is_anonymous, submitter_email, submitter_name, category, subject, message, page_url, user_agent, status, admin_notes, resolved_by, resolved_at, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter !== 'all') {
    query = query.eq('status', filter);
  }

  const { data: tickets, error } = await query;
  if (error) {
    console.error('[AdminFeedback] list failed', error);
    return { ok: false, error: 'Failed to load tickets.' };
  }

  // Counts per status (one round-trip per bucket — small constant).
  const buckets: FeedbackTicketStatus[] = ['open', 'reviewing', 'resolved', 'archived'];
  const counts: FeedbackStatusCounts = {
    open: 0,
    reviewing: 0,
    resolved: 0,
    archived: 0,
    total: 0,
  };

  await Promise.all(
    buckets.map(async (b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (admin as any)
        .from('feedback_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', b);
      counts[b] = count ?? 0;
    }),
  );
  counts.total = counts.open + counts.reviewing + counts.resolved + counts.archived;

  return {
    ok: true,
    tickets: (tickets ?? []) as AdminFeedbackTicket[],
    counts,
  };
}

export async function updateFeedbackTicketStatus(
  ticketId: string,
  status: FeedbackTicketStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  const admin = getSupabaseServerAdminClient();
  const patch: Record<string, unknown> = { status };

  if (status === 'resolved') {
    patch.resolved_by = adminId;
    patch.resolved_at = new Date().toISOString();
  } else if (status === 'open' || status === 'reviewing') {
    patch.resolved_by = null;
    patch.resolved_at = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('feedback_tickets')
    .update(patch)
    .eq('id', ticketId);

  if (error) {
    console.error('[AdminFeedback] update status failed', error);
    return { ok: false, error: 'Failed to update ticket.' };
  }

  revalidatePath('/admin/feedback');
  return { ok: true };
}

export async function saveFeedbackTicketNotes(
  ticketId: string,
  notes: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: 'Unauthorized' };

  const admin = getSupabaseServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('feedback_tickets')
    .update({ admin_notes: notes.slice(0, 4000) })
    .eq('id', ticketId);

  if (error) {
    console.error('[AdminFeedback] save notes failed', error);
    return { ok: false, error: 'Failed to save notes.' };
  }

  revalidatePath('/admin/feedback');
  return { ok: true };
}
