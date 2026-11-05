/**
 * Parses a date-only string ("2026-11-07") as a local calendar date.
 *
 * `new Date("2026-11-07")` is UTC midnight, which displays as the previous
 * day in US time zones. Full timestamps fall through to `new Date()`.
 */
export function parseDateOnly(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

/** End of the given calendar day (local), so an end date is inclusive. */
export function endOfDateOnly(value: string): Date {
  const d = parseDateOnly(value);
  d.setHours(23, 59, 59, 999);
  return d;
}
