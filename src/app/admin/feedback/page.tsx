import Link from 'next/link';
import { requireAdmin } from '~/lib/admin';
import { Button } from '@kit/ui/button';
import { listFeedbackTickets, type FeedbackTicketStatus } from './_actions/admin-feedback';
import { FeedbackTicketsList } from './_components/feedback-tickets-list';

export const metadata = {
  title: 'Feedback tickets | Admin | Provenance',
};

const VALID_FILTERS = new Set<FeedbackTicketStatus | 'all'>([
  'all',
  'open',
  'reviewing',
  'resolved',
  'archived',
]);

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = (
    VALID_FILTERS.has(sp?.status as FeedbackTicketStatus | 'all')
      ? sp.status
      : 'all'
  ) as FeedbackTicketStatus | 'all';

  const result = await listFeedbackTickets(filter);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold text-wine mb-2">
            Feedback tickets
          </h1>
          <p className="text-ink/70 font-serif">
            Triage submissions from the public feedback page. Mark status,
            leave internal notes, follow up by email when appropriate.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="font-serif border-wine/30 shrink-0"
        >
          <Link href="/admin">← Admin home</Link>
        </Button>
      </div>

      {!result.ok ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 font-serif text-sm text-red-700">
          {result.error}
        </p>
      ) : (
        <FeedbackTicketsList
          tickets={result.tickets}
          counts={result.counts}
          activeFilter={filter}
        />
      )}
    </div>
  );
}
