export function formatBlogDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}
