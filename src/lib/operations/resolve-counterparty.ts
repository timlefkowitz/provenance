import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { sendEmail } from '~/lib/email';
import type { NotificationType } from '~/lib/notifications';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export type CounterpartyRole =
  | 'borrower'
  | 'lender'
  | 'consignee'
  | 'courier'
  | 'insurer'
  | 'appraiser'
  | 'seller'
  | 'curator'
  | 'custodian'
  | 'vendor_contact';

export type CounterpartyRecordKind =
  | 'loan'
  | 'consignment'
  | 'shipment'
  | 'insurance'
  | 'acquisition'
  | 'exhibition_plan'
  | 'inventory_location'
  | 'vendor';

export type CounterpartyResolution = {
  userId: string | null;
  status: 'linked' | 'invited' | 'skipped';
};

function normalizeEmail(value: string | null | undefined): string | null {
  const t = (value ?? '').trim().toLowerCase();
  return t ? t : null;
}

function roleLabelForEmail(role: CounterpartyRole, kind: CounterpartyRecordKind): string {
  if (kind === 'consignment') {
    return 'a consignee on a consignment';
  }
  if (kind === 'shipment') {
    return 'a courier for a shipment';
  }
  if (kind === 'insurance' && role === 'insurer') {
    return 'a contact for insurance / valuation on this work';
  }
  if (kind === 'insurance' && role === 'appraiser') {
    return 'an appraiser for this work';
  }
  if (kind === 'acquisition' && role === 'seller') {
    return 'a seller on an acquisition for this work';
  }
  if (kind === 'exhibition_plan' && role === 'lender') {
    return 'a lender for an exhibition object plan';
  }
  if (kind === 'exhibition_plan' && role === 'curator') {
    return 'a curator for an exhibition object plan';
  }
  if (kind === 'inventory_location' && role === 'custodian') {
    return 'a custodian for inventory / location for this work';
  }
  if (kind === 'vendor' && role === 'vendor_contact') {
    return 'a contact for a vendor partner';
  }
  if (kind === 'loan' && role === 'borrower') {
    return 'a borrower on a loan';
  }
  if (kind === 'loan' && role === 'lender') {
    return 'a lender on a loan';
  }
  return 'a contact in Operations for this work';
}

function kindLabelForInvite(kind: CounterpartyRecordKind): string {
  switch (kind) {
    case 'loan':
      return 'a loan';
    case 'consignment':
      return 'a consignment';
    case 'shipment':
      return 'this shipment';
    case 'insurance':
      return 'this insurance / valuation';
    case 'acquisition':
      return 'this acquisition';
    case 'exhibition_plan':
      return 'this exhibition object plan';
    case 'inventory_location':
      return 'this location record';
    case 'vendor':
      return 'this vendor partner record';
    default:
      return 'this record';
  }
}

function counterpartyLinkedNotificationType(
  kind: CounterpartyRecordKind,
): NotificationType {
  switch (kind) {
    case 'loan':
      return 'loan_counterparty_linked';
    case 'consignment':
      return 'consignment_counterparty_linked';
    case 'shipment':
      return 'shipment_counterparty_linked';
    case 'insurance':
      return 'insurance_counterparty_linked';
    case 'acquisition':
      return 'acquisition_counterparty_linked';
    case 'exhibition_plan':
      return 'exhibition_plan_counterparty_linked';
    case 'inventory_location':
      return 'inventory_location_counterparty_linked';
    case 'vendor':
      return 'vendor_counterparty_linked';
    default:
      return 'loan_counterparty_linked';
  }
}

function counterpartyLinkedTitle(kind: CounterpartyRecordKind): string {
  switch (kind) {
    case 'loan':
      return 'You were added to a loan';
    case 'consignment':
      return 'You were added to a consignment';
    case 'shipment':
      return 'You were added to a shipment';
    case 'insurance':
      return 'You were added to an insurance/valuation';
    case 'acquisition':
      return 'You were added to an acquisition';
    case 'exhibition_plan':
      return 'You were added to an exhibition object plan';
    case 'inventory_location':
      return 'You were added to a location / inventory record';
    case 'vendor':
      return 'You were added as a vendor contact';
    default:
      return 'You were added in Operations';
  }
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

    const shouldNotifyInApp =
      priorE !== emailNorm || !priorId || priorId !== (acct.id as string);
    if (shouldNotifyInApp) {
      const type = counterpartyLinkedNotificationType(input.recordKind);
      const title = counterpartyLinkedTitle(input.recordKind);
      const roleWording = roleLabelForEmail(input.role, input.recordKind);
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

  const shouldSendInvite = priorE !== emailNorm || !priorE;
  if (shouldSendInvite) {
    const ownerName = await getOwnerDisplayName(input.ownerAccountId, input.ownerDisplayName);
    const roleWording = roleLabelForEmail(input.role, input.recordKind);
    const signUpUrl = `${SITE_URL.replace(/\/$/, '')}/auth/sign-up`;
    const itemLabel = kindLabelForInvite(input.recordKind);
    const html = `
      <p>Hi,</p>
      <p>${escapeHtml(ownerName)} added you as ${roleWording.replace(/^a |^an /, '')} for <strong>${escapeHtml(input.artworkTitle)}</strong> on Provenance.</p>
      <p>Create an account to see ${itemLabel} and notifications in the app.</p>
      <p><a href="${signUpUrl}" style="display:inline-block;padding:10px 16px;background:#2d1f3d;color:#fff;border-radius:6px;text-decoration:none">Join Provenance</a></p>
      <p style="color:#666;font-size:12px">If you did not expect this, you can ignore this email.</p>
    `;
    await sendEmail({
      to: emailNorm,
      subject: "You've been added to a workflow on Provenance",
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

type CounterpartyStatusKind =
  | 'loan'
  | 'consignment'
  | 'shipment'
  | 'insurance'
  | 'acquisition'
  | 'exhibition_plan';

/**
 * In-app status notifications for linked counterparties (e.g. loan active, shipment in transit).
 * Pass `milestone` for new kinds: shipment `in_transit`, insurance `active`, acquisition `accessioned`, exhibition_plan `confirmed`.
 */
export async function notifyCounterpartyStatusActive(input: {
  kind: CounterpartyStatusKind;
  counterpartyUserId: string | null;
  ownerAccountId: string;
  recordId: string;
  artworkId: string;
  artworkTitle: string;
  /** For non-loan/consignment, narrow the event */
  milestone?: 'in_transit' | 'active' | 'accessioned' | 'confirmed';
}): Promise<void> {
  if (!input.counterpartyUserId) {
    return;
  }
  const admin = getSupabaseServerAdminClient() as any;

  let type: NotificationType;
  let title: string;
  let message: string;

  if (input.kind === 'loan') {
    type = 'loan_status_update';
    title = 'Loan is now active';
    message = `The loan for "${input.artworkTitle}" is now active. Open Operations to view.`;
  } else if (input.kind === 'consignment') {
    type = 'consignment_status_update';
    title = 'Consignment is now active';
    message = `The consignment for "${input.artworkTitle}" is now active. Open Operations to view.`;
  } else if (input.kind === 'shipment' && input.milestone === 'in_transit') {
    type = 'shipment_status_update';
    title = 'Shipment in transit';
    message = `The shipment for "${input.artworkTitle}" is now in transit. Open Operations to view.`;
  } else if (input.kind === 'insurance' && input.milestone === 'active') {
    type = 'insurance_status_update';
    title = 'Insurance/valuation is active';
    message = `Insurance/valuation for "${input.artworkTitle}" is now active. Open Operations to view.`;
  } else if (input.kind === 'acquisition' && input.milestone === 'accessioned') {
    type = 'acquisition_status_update';
    title = 'Work accessioned';
    message = `The acquisition for "${input.artworkTitle}" is now accessioned. Open Operations to view.`;
  } else if (input.kind === 'exhibition_plan' && input.milestone === 'confirmed') {
    type = 'exhibition_plan_status_update';
    title = 'Exhibition object plan confirmed';
    message = `The exhibition object plan for "${input.artworkTitle}" is now confirmed. Open Operations to view.`;
  } else {
    console.log('[Operations/resolveCounterparty] notifyCounterpartyStatusActive skipped: unknown kind/milestone', input);
    return;
  }

  const { error } = await admin.from('notifications').insert({
    user_id: input.counterpartyUserId,
    type,
    title,
    message,
    artwork_id: input.artworkId,
    related_user_id: input.ownerAccountId,
    read: false,
    metadata: {
      record_id: input.recordId,
      record_kind: input.kind,
      milestone: input.milestone ?? null,
    },
  });
  if (error) {
    console.error('[Operations/resolveCounterparty] status-active notification failed', error);
  } else {
    console.log('[Operations/resolveCounterparty] status-active notification', input.recordId, type);
  }
}

/**
 * Vendor directory: link contact email to Provenance user or send signup invite (no artwork context).
 */
export async function resolveVendorContact(input: {
  email: string | null | undefined;
  recordId: string;
  ownerAccountId: string;
  ownerDisplayName?: string;
  vendorName: string;
  serviceType: string;
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
    console.error('[Operations/resolveVendorContact] account lookup failed', lookupErr);
    return { userId: null, status: 'skipped' };
  }

  if (acct?.id) {
    if (acct.id === input.ownerAccountId) {
      console.log('[Operations/resolveVendorContact] contact is owner; not linking', input.recordId);
      return { userId: null, status: 'skipped' };
    }
    const shouldNotifyInApp =
      priorE !== emailNorm || !priorId || priorId !== (acct.id as string);
    if (shouldNotifyInApp) {
      const title = counterpartyLinkedTitle('vendor');
      const message = `You have been added as a contact for vendor "${input.vendorName}" (${input.serviceType}). Open Operations to view.`;
      const { error: nErr } = await admin.from('notifications').insert({
        user_id: acct.id,
        type: 'vendor_counterparty_linked',
        title,
        message,
        artwork_id: null,
        related_user_id: input.ownerAccountId,
        read: false,
        metadata: {
          role: 'vendor_contact',
          record_id: input.recordId,
          record_kind: 'vendor',
          vendor_name: input.vendorName,
        },
      });
      if (nErr) {
        console.error('[Operations/resolveVendorContact] notification insert failed', nErr);
      } else {
        console.log('[Operations/resolveVendorContact] in-app linked notification', input.recordId);
      }
    }
    return { userId: acct.id as string, status: 'linked' };
  }

  const shouldSendInvite = priorE !== emailNorm || !priorE;
  if (shouldSendInvite) {
    const ownerName = await getOwnerDisplayName(input.ownerAccountId, input.ownerDisplayName);
    const signUpUrl = `${SITE_URL.replace(/\/$/, '')}/auth/sign-up`;
    const st = escapeHtml(input.serviceType);
    const vn = escapeHtml(input.vendorName);
    const html = `
      <p>Hi,</p>
      <p>${escapeHtml(ownerName)} added you as a <strong>${st}</strong> partner contact for <strong>${vn}</strong> on Provenance.</p>
      <p>Create an account to see this vendor record and notifications in the app.</p>
      <p><a href="${signUpUrl}" style="display:inline-block;padding:10px 16px;background:#2d1f3d;color:#fff;border-radius:6px;text-decoration:none">Join Provenance</a></p>
      <p style="color:#666;font-size:12px">If you did not expect this, you can ignore this email.</p>
    `;
    await sendEmail({
      to: emailNorm,
      subject: "You've been added to a workflow on Provenance",
      html,
    });
    console.log('[Operations/resolveVendorContact] signup invite sent (no account)', emailNorm);
  }

  return { userId: null, status: 'invited' };
}
