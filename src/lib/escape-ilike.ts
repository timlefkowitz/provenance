/** Escape for use in ilike: % and _ are wildcards in PostgreSQL */
export function escapeIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
