const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/** Split pasted text into unique, lowercased email addresses. */
export function parseEmailList(text: string): string[] {
  const parts = text.split(/[\s,;\n\r\t]+/);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of parts) {
    const email = part.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }

  return out;
}

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_RE.test(email);
}
