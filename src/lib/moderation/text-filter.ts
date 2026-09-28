/**
 * Lightweight pre-publish filter for objectionable text (guideline 1.2:
 * "a method for filtering objectionable material from being posted").
 *
 * Deliberately high-precision: whole-word matches on a short list of slurs
 * and explicit sexual terms, after normalizing common obfuscations. Art
 * titles legitimately include words like "nude", "breast" or "kill", so
 * those are NOT blocked — anything subtler is handled by user reports and
 * admin review at /admin/reports.
 */

const BLOCKED_TERMS = [
  // Slurs
  'nigger', 'nigga', 'faggot', 'fag', 'kike', 'spic', 'chink', 'gook', 'wetback', 'raghead',
  'tranny', 'retard', 'retarded',
  // Explicit sexual / abusive
  'cunt', 'motherfucker', 'cocksucker', 'blowjob', 'cumshot', 'gangbang', 'bukkake',
  'porn', 'porno', 'pornhub', 'xvideos', 'onlyfans',
  'child porn', 'cp links', 'kill yourself', 'kys',
];

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i',
};

export function normalizeForFilter(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    // Collapse separators used to dodge filters ("f.a.g", "k-y-s") into spaces.
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PATTERNS = BLOCKED_TERMS.map(
  (term) => new RegExp(`(^|\\s)${term.replace(/\s+/g, '\\s')}(s|es)?(\\s|$)`),
);

/** Returns true when any provided field contains a blocked term. */
export function containsObjectionableText(...fields: (string | null | undefined)[]): boolean {
  for (const field of fields) {
    if (!field) continue;
    const normalized = normalizeForFilter(field);
    // Also check with single-letter gaps removed ("k y s" -> "kys").
    const squashed = normalized.replace(/\b(\w) (?=\w\b)/g, '$1');
    if (PATTERNS.some((re) => re.test(normalized) || re.test(squashed))) return true;
  }
  return false;
}

export const OBJECTIONABLE_TEXT_MESSAGE =
  'This contains language that isn’t allowed on Provenance. Please edit it and try again.';
