import { isValidEmailFormat } from '~/lib/lead-email-parse';

export type LeadEmailQuality = 'good' | 'maybe' | 'bad';

export type LeadEmailQualityResult = {
  quality: LeadEmailQuality;
  reason: string;
};

const DISPOSABLE_OR_DEAD_DOMAINS = new Set([
  'webtv.net',
  'excite.com',
  'kittymail.com',
  'netzero.net',
  'in.com',
  'freelancer.com',
]);

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.com.tr',
  'yahoo.in',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.co.nz',
  'outlook.com',
  'live.com',
  'live.no',
  'aol.com',
  'icloud.com',
  'me.com',
  'mail.com',
  'ymail.com',
  'rocketmail.com',
  'proton.me',
  'protonmail.com',
]);

const GENERIC_LOCAL_PARTS = new Set([
  'info',
  'contact',
  'hello',
  'admin',
  'support',
  'sales',
  'noreply',
  'no-reply',
]);

function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

function localPart(email: string): string {
  return email.split('@')[0]?.toLowerCase() ?? '';
}

/**
 * Heuristic quality score for a bare email address (no lead metadata).
 * Used before sending outreach invites.
 */
export function assessLeadEmailQuality(email: string): LeadEmailQualityResult {
  if (!isValidEmailFormat(email)) {
    return { quality: 'bad', reason: 'invalid_format' };
  }

  const dom = emailDomain(email);
  const lp = localPart(email);

  if (!dom || !lp) {
    return { quality: 'bad', reason: 'invalid_format' };
  }

  if (DISPOSABLE_OR_DEAD_DOMAINS.has(dom)) {
    return { quality: 'bad', reason: 'disposable_or_dead_domain' };
  }

  if (GENERIC_LOCAL_PARTS.has(lp)) {
    return { quality: 'maybe', reason: 'generic_role_address' };
  }

  if (FREE_EMAIL_DOMAINS.has(dom)) {
    return { quality: 'maybe', reason: 'free_email_provider' };
  }

  if (dom.endsWith('.edu') || dom.endsWith('.gov') || dom.endsWith('.gov.uk')) {
    return { quality: 'good', reason: 'institutional_domain' };
  }

  // Corporate / custom domains are generally the best outreach targets.
  return { quality: 'good', reason: 'business_or_custom_domain' };
}

export function canSendOutreachInvite(
  quality: LeadEmailQuality,
  includeMaybe: boolean,
): boolean {
  if (quality === 'bad') return false;
  if (quality === 'good') return true;
  return includeMaybe;
}
