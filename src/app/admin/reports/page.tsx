import Link from 'next/link';
import { requireAdmin } from '~/lib/admin';
import { Button } from '@kit/ui/button';
import { listContentReports, type ReportStatus } from './_actions/admin-reports';
import { ReportsList } from './_components/reports-list';

export const metadata = {
  title: 'Content reports | Admin | Provenance',
};

const VALID_FILTERS = new Set<ReportStatus | 'all'>(['open', 'actioned', 'dismissed', 'all']);

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = (VALID_FILTERS.has(sp?.status as ReportStatus | 'all') ? sp.status : 'open') as
    | ReportStatus
    | 'all';

  const result = await listContentReports(filter);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold text-wine mb-2">Content reports</h1>
          <p className="text-ink/70 font-serif">
            User reports of objectionable content. Our Terms promise action within 24 hours — hide content that
            breaks them, and suspend users for egregious or repeated abuse.
          </p>
        </div>
        <Button asChild variant="outline" className="font-serif border-wine/30 shrink-0">
          <Link href="/admin">← Admin home</Link>
        </Button>
      </div>

      <nav className="mb-6 flex gap-2 font-serif text-sm" aria-label="Filter reports">
        {(['open', 'actioned', 'dismissed', 'all'] as const).map((f) => (
          <Link
            key={f}
            href={`/admin/reports?status=${f}`}
            className={`rounded-full px-3 py-1 border ${
              filter === f ? 'bg-wine text-parchment border-wine' : 'border-ink/20 text-ink/70 hover:border-wine/50'
            }`}
          >
            {f[0]!.toUpperCase() + f.slice(1)}
            {f === 'open' && result.ok ? ` (${result.openCount})` : ''}
          </Link>
        ))}
      </nav>

      {!result.ok ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 font-serif text-sm text-red-700">
          {result.error}
        </p>
      ) : (
        <ReportsList reports={result.reports} />
      )}
    </div>
  );
}
