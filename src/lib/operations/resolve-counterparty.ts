import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { sendEmail } from '~/lib/email';
import type { NotificationType } from '~/lib/notifications';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export type CounterpartyRole = 'borrower' | 'lender' | 'consignee';

export type CounterpartyRecordKind = 'loan' | 'consignment';

export type CounterpartyResolution = {
  userId: string | null;
  status: 'linked' | 'invited' | 'skipped';
};

function normalizeEmail(value: string | null | undefined): string | null {
  const t = (value ?? '').trim().toLowerCase();
  return t ? t : null;
}

function roleLabelForEmail(
  role: CounterpartyRole,
  kind: CounterpartyRecordKind,
): string {
  if (kind === 'consignment') {
    return 'a consignee on a consignment';
  }
  if (role === 'borrower') {
    return 'a borrower on a loan';
  }
  if (role === 'lender') {
    return 'a lender on a loan';
  }
  return 'a contact on a loan';
}

async function getOwnerDisplayName(ownerAccountId: string, provided?: string): Promise<string> {
  if (provided?.trim()) {
    return provided.trim();
  }
  const admin = getSupabaseServerAdminClient() as any;
  const { data, error } = await admin
    .from('accounts')
    .select('name, email')
    .eq('id', ownerAccountId)
    .maybeSingle();
  if (error) {
    console.error('[Operations/resolveCounterparty] getOwnerDisplayName failed', error);
  }
  const name = data?.name != null && String(data.name).trim() ? String(data.name).trim() : null;
  return name || (data?.email as string) || 'A Provenance user';
}

/**
 * Look up Provenance user by account email, notify in-app or send signup invite.
 * Does not throw — returns skipped on empty email or on lookup errors (logged).
 */
export async function resolveCounterparty(input: {
  email: string | null | undefined;
  role: CounterpartyRole;
  recordKind: CounterpartyRecordKind;
  recordId: string;
  ownerAccountId: string;
  ownerDisplayName?: string;
  artworkId: string;
  artworkTitle: string;
  priorEmail: string | null | undefined;
  priorLinkedUserId: string | null | undefined;
}): Promise<CounterpartyResolution> {
  const emailNorm = normalizeEmail(input.email);
  if (!emailNorm) {
    return { userId: null, status: 'skipped' };
  }

  const priorE = normalizeEmail(input.priorEmail);
  const priorId = input.priorLinkedUserId ?? null;

  const admin = getSupabaseServerAdminClient() as any;
  const { data: acct, error: lookupErr } = await admin
    .from('accounts')
    .select('id, email')
    .eq('email', emailNorm)
    .maybeSingle();

  if (lookupErr) {
    console.error('[Operations/resolveCounterparty] account lookup failed', lookupErr);
    return { userId: null, status: 'skipped' };
  }

  if (acct?.id) {
    if (acct.id === input.ownerAccountId) {
      console.log('[Operations/resolveCounterparty] counterparty is owner; not linking', input.recordId);
      return { userId: null, status: 'skipped' };
    }

    // Avoid duplicate in-app toasts: same email + same linked user, already notified before
    const shouldNotifyInApp =
      priorE !== emailNorm || !priorId || priorId !== (acct.id as string);
    if (shouldNotifyInApp) {
      const kind = input.recordKind;
      const type: NotificationType =
        kind === 'loan' ? 'loan_counterparty_linked' : 'consignment_counterparty_linked';
      const title = kind === 'loan' ? 'You were added to a loan' : 'You were added to a consignment';
      const roleWording = roleLabelForEmail(input.role, kind);
      const message = `You have been added as ${roleWording} for "${input.artworkTitle}". Open Operations to view.`;
      const { error: nErr } = await admin.from('notifications').insert({
        user_id: acct.id,
        type,
        title,
        message,
        artwork_id: input.artworkId,
        related_user_id: input.ownerAccountId,
        read: false,
        metadata: {
          role: input.role,
          record_id: input.recordId,
          record_kind: input.recordKind,
        },
      });
      if (nErr) {
        console.error('[Operations/resolveCounterparty] notification insert failed', nErr);
      } else {
        console.log('[Operations/resolveCounterparty] in-app linked notification', input.recordId, type);
      }
    }

    return { userId: acct.id as string, status: 'linked' };
  }

  // No account: invite (first time for this address on the row, or when the email was just changed)
  const shouldSendInvite = priorE !== emailNorm || !priorE;
  if (shouldSendInvite) {
    const ownerName = await getOwnerDisplayName(input.ownerAccountId, input.ownerDisplayName);
    const roleWording = roleLabelForEmail(input.role, input.recordKind);
    const signUpUrl = `${SITE_URL.replace(/\/$/, '')}/auth/sign-up`;
    const kindLabel = input.recordKind === 'loan' ? 'a loan' : 'a consignment';
    const html = `
      <p>Hi,</p>
      <p>${escapeHtml(ownerName)} added you as ${roleWording.replace(/^a /, '')} for <strong>${escapeHtml(input.artworkTitle)}</strong> on Provenance.</p>
      <p>Create an account to see ${kindLabel} and notifications in the app.</p>
      <p><a href="${signUpUrl}" style="display:inline-block;padding:10px 16px;background:#2d1f3d;color:#fff;border-radius:6px;text-decoration:none">Join Provenance</a></p>
      <p style="color:#666;font-size:12px">If you did not expect this, you can ignore this email.</p>
    `;
    await sendEmail({
      to: emailNorm,
      subject: "You've been added to a loan/consignment on Provenance",
      html,
    });
    console.log('[Operations/resolveCounterparty] signup invite sent (no account)', emailNorm);
  }

  return { userId: null, status: 'invited' };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * When a loan or consignment becomes active, notify the counterparty in-app.
 */
export async function notifyCounterpartyStatusActive(input: {
  kind: 'loan' | 'consignment';
  counterpartyUserId: string | null;
  ownerAccountId: string;
  recordId: string;
  artworkId: string;
  artworkTitle: string;
}): Promise<void> {
  if (!input.counterpartyUserId) {
    return;
  }
  const type: NotificationType =
    input.kind === 'loan' ? 'loan_status_update' : 'consignment_status_update';
  const title = input.kind === 'loan' ? 'Loan is now active' : 'Consignment is now active';
  const what = input.kind === 'loan' ? 'loan' : 'consignment';
  const message = `The ${what} for "${input.artworkTitle}" is now active. Open Operations to view.`;
  const admin = getSupabaseServerAdminClient() as any;
  const { error } = await admin.from('notifications').insert({
    user_id: input.counterpartyUserId,
    type,
    title,
    message,
    artwork_id: input.artworkId,
    related_user_id: input.ownerAccountId,
    read: false,
    metadata: { record_id: input.recordId, record_kind: input.kind },
  });
  if (error) {
    console.error('[Operations/resolveCounterparty] status-active notification failed', error);
  } else {
    console.log('[Operations/resolveCounterparty] status-active notification', input.recordId, type);
  }
}
