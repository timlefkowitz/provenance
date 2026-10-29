import type { CollectorSummary } from '~/lib/collectors/group-collectors';

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

export function collectorLabel(c: Pick<CollectorSummary, 'name' | 'email' | 'accountId'>): string {
  return c.name || c.email || (c.accountId ? 'Platform collector' : 'Unknown buyer');
}
