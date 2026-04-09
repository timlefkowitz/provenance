/**
 * Next.js Server Actions are bound to a specific build. If the browser keeps an old
 * JS bundle (CDN/cache) after a rollback or redeploy, POSTs return 404 / UnrecognizedActionError.
 */
export function isStaleServerActionError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false;
  const e = error as Error & { digest?: string };
  const name = e.name ?? '';
  const message = typeof e.message === 'string' ? e.message : '';
  return (
    name === 'UnrecognizedActionError' ||
    message.includes('was not found on the server') ||
    message.includes('Failed to find Server Action')
  );
}
