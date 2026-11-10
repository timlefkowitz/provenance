import { emailsMatch, normalizeInviteEmail } from '~/lib/certificate-claims/tokens';

/**
 * Pure helpers for who a profile handoff goes to. A handoff targets either an email address
 * (someone who may not be on Provenance yet) or an existing account picked by search.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type HandoffTarget =
  | { kind: 'email'; email: string }
  | { kind: 'user'; userId: string };

export type HandoffTargetInput = {
  email?: string | null;
  recipientUserId?: string | null;
  /** Saved on the managed profile; used when no email is passed in */
  fallbackEmail?: string | null;
};

export function resolveHandoffTarget(
  input: HandoffTargetInput,
): { ok: true; target: HandoffTarget } | { ok: false; error: string } {
  const userId = input.recipientUserId?.trim();
  if (userId) {
    return { ok: true, target: { kind: 'user', userId } };
  }
  const email = normalizeInviteEmail(input.email?.trim() || input.fallbackEmail?.trim() || '');
  if (!email) {
    return { ok: false, error: 'Pick someone on Provenance or enter their email address' };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'Enter a valid email address' };
  }
  return { ok: true, target: { kind: 'email', email } };
}

export type InviteRecipientFields = {
  recipient_user_id?: string | null;
  invitee_email?: string | null;
};

/** True when the signed-in user is who this invite was sent to. */
export function inviteIsForUser(
  invite: InviteRecipientFields | null | undefined,
  user: { id: string; email?: string | null },
): boolean {
  if (!invite) return false;
  if (invite.recipient_user_id) return invite.recipient_user_id === user.id;
  return Boolean(user.email && invite.invitee_email && emailsMatch(user.email, invite.invitee_email));
}
