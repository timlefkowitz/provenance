import Link from 'next/link';
import { Badge } from '@kit/ui/badge';
import type { ProvenanceEventSummary } from '../page';

type Props = {
  events: ProvenanceEventSummary[];
  title?: string;
};

const labels: Record<string, string> = {
  ownership_transfer: 'Ownership',
  exhibition: 'Exhibition',
  loan_out: 'Loan out',
  loan_return: 'Loan return',
  consignment_active: 'Consignment (active)',
  consignment_sold: 'Consignment (sold)',
  consignment_returned: 'Consignment (returned)',
  artwork_shipped: 'Artwork shipped',
  artwork_received: 'Artwork received',
  insurance_active: 'Insurance / valuation (active)',
  insurance_expired: 'Insurance (expired)',
  artwork_accessioned: 'Accessioned',
  exhibition_object_confirmed: 'Exhibition object (confirmed)',
  exhibition_object_installed: 'Exhibition object (installed)',
  artwork_location_updated: 'Location updated',
  authentication: 'Authentication',
  coa_issued: 'COA issued',
  coo_issued: 'COO issued',
  cos_issued: 'COS issued',
};

export function ProvenanceTimeline({ events, title = 'Recent provenance events' }: Props) {
  if (!events.length) {
    return (
      <div className="rounded-md border border-wine/10 bg-parchment/30 p-4">
        <h3 className="font-display text-wine text-sm mb-1">{title}</h3>
        <p className="text-ink/55 font-serif text-sm">No events yet. Loans and consignments will add entries here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-wine/10 bg-parchment/30 p-4">
      <h3 className="font-display text-wine text-sm mb-3">{title}</h3>
      <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {events.map((e) => (
          <li key={e.id} className="border-b border-wine/10 pb-3 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-serif text-xs">
                {labels[e.event_type] ?? e.event_type}
              </Badge>
              <span className="text-xs text-ink/50 font-serif">
                {new Date(e.event_date).toLocaleString()}
              </span>
            </div>
            {e.artwork ? (
              <Link
                className="text-wine text-sm font-serif underline mt-1 inline-block"
                href={`/artworks/${e.artwork.id}`}
              >
                {e.artwork.title}
              </Link>
            ) : null}
            {e.metadata && Object.keys(e.metadata).length > 0 ? (
              <p className="text-xs text-ink/60 font-mono mt-1 break-all">
                {e.metadata.borrower_name ? `Borrower: ${e.metadata.borrower_name}. ` : null}
                {e.metadata.consignee_name ? `Consignee: ${e.metadata.consignee_name}. ` : null}
                {e.metadata.sale_price_cents != null
                  ? `Sale: ${(Number(e.metadata.sale_price_cents) / 100).toFixed(2)}. `
                  : null}
                {e.metadata.reason ? `${e.metadata.reason}.` : null}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
