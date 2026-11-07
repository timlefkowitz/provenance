/**
 * Small helpers for the public phone numbers people post on exhibitions and
 * profiles. We store what they typed (trimmed) and only normalise for display
 * and for `tel:` links.
 */

const MAX_PHONE_LENGTH = 40;

/** Digits plus an optional leading +, for `tel:` hrefs. */
export function phoneDigits(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/**
 * Validate and clean a phone number a user typed. Returns null for empty
 * input, throws for something that is clearly not a phone number.
 */
export function normalizePhoneInput(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (value.length > MAX_PHONE_LENGTH || !/^[+\d\s().\-x]+$/i.test(value)) {
    throw new Error('Enter a phone number using digits, spaces, dashes or parentheses');
  }
  const count = value.replace(/\D/g, '').length;
  if (count < 7 || count > 15) {
    throw new Error('Phone numbers need between 7 and 15 digits');
  }
  return value;
}

/** Pretty-print US 10/11 digit numbers; leave everything else as typed. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const international = raw.trim().startsWith('+');
  let ten: string | null = null;
  if (digits.length === 11 && digits.startsWith('1')) ten = digits.slice(1);
  else if (digits.length === 10 && !international) ten = digits;
  if (!ten) return raw.trim();
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export function phoneHref(raw: string): string {
  return `tel:${phoneDigits(raw)}`;
}
