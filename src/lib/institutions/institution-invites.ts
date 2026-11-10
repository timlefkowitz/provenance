/**
 * Institution invites: a Provenance admin invites an institution's team by
 * email, each person with their own link and a complimentary trial.
 * Pure helpers shared by the admin page, the accept page, and their actions.
 */

export const DEFAULT_INSTITUTION_TRIAL_DAYS = 90;
export const INSTITUTION_TRIAL_DAY_OPTIONS = [30, 60, 90, 180, 365] as const;
export const MAX_INVITES_PER_SEND = 50;

export const INSTITUTION_INVITE_PATH = '/institution-invite';

export type InstitutionTeamRole = 'admin' | 'member';

export type InstitutionInviteStatus = 'pending' | 'accepted' | 'revoked';

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export type ParsedInviteEmails = {
  /** Valid, lower-cased, de-duplicated addresses in the order given. */
  valid: string[];
  /** Entries that don't look like an email address. */
  invalid: string[];
};

/**
 * Splits pasted text (commas, semicolons, spaces, new lines, or
 * "Name <email>" entries) into addresses.
 */
export function parseInviteEmails(raw: string): ParsedInviteEmails {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  const withoutNames = raw.replace(/[^<>,;\n]*<([^<>]+)>/g, ' $1 ');
  for (const part of withoutNames.split(/[\s,;]+/)) {
    const entry = part.trim().replace(/^mailto:/i, '');
    if (!entry) continue;
    const email = entry.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      invalid.push(entry);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }

  return { valid, invalid };
}

export function isAllowedTrialDays(days: number): boolean {
  return (INSTITUTION_TRIAL_DAY_OPTIONS as readonly number[]).includes(days);
}

/** When a trial that starts at `start` ends. */
export function institutionTrialEnd(start: Date, trialDays: number): Date {
  return new Date(start.getTime() + trialDays * 24 * 60 * 60 * 1000);
}

export function getInstitutionInviteStatus(invite: {
  accepted_at: string | null;
  revoked_at: string | null;
}): InstitutionInviteStatus {
  if (invite.accepted_at) return 'accepted';
  if (invite.revoked_at) return 'revoked';
  return 'pending';
}

/** Same-origin path of the accept page for an invite token. */
export function institutionInvitePath(token: string): string {
  return `${INSTITUTION_INVITE_PATH}?token=${encodeURIComponent(token)}`;
}

/** Subscription row id for an invite's trial, so accepting twice grants once. */
export function institutionTrialSubscriptionId(inviteId: string): string {
  return `institution_trial_${inviteId}`;
}

export function formatTrialLength(days: number): string {
  if (days % 30 === 0 && days < 365) {
    const months = days / 30;
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  if (days === 365) return '1 year';
  return `${days} days`;
}

/**
 * Whether a person who accepts should be locked to institution mode: only
 * when their account has no artist, collector, or gallery profiles of its own,
 * so we never hide someone's existing work.
 */
export function shouldLockAccountToInstitution(ownedProfileRoles: string[]): boolean {
  return ownedProfileRoles.every((role) => role === 'institution');
}
