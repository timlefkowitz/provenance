import Link from 'next/link';
import { Repeat } from 'lucide-react';

import type { CollectorSummary } from '~/lib/collectors/group-collectors';
import type { GalleryExhibition } from '~/lib/collectors/load-gallery-collector-data';
import { formatMoney } from '~/lib/portal-graphs/types';
import { collectorLabel } from './format';

interface RepeatCollectorsPanelProps {
  collectors: CollectorSummary[];
  exhibitions: GalleryExhibition[];
}

/** Repeat buyers are the first people to invite to the next show. */
export function RepeatCollectorsPanel({ collectors, exhibitions }: RepeatCollectorsPanelProps) {
  if (!collectors.length) return null;

  const today = new Date().toISOString().slice(0, 10);
  const nextShow = [...exhibitions]
    .filter((e) => e.start_date && e.start_date >= today)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))[0];
  const emails = collectors.map((c) => c.email).filter((e): e is string => !!e);
  const subject = nextShow ? `You're invited: ${nextShow.title}` : 'Our next exhibition';

  return (
    <div className="rounded-xl border border-wine/20 bg-white/70 p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-wine flex items-center gap-2">
            <Repeat className="h-4 w-4 text-wine/60" />
            Invite to your next show
          </h2>
          <p className="text-xs font-serif text-ink/50 mt-1">
            {collectors.length} {collectors.length === 1 ? 'collector has' : 'collectors have'} bought from more than one of your shows
            {nextShow ? <> &middot; next up: <span className="text-ink/70">{nextShow.title}</span></> : null}.
          </p>
        </div>
      </div>

      <ul className="flex flex-wrap gap-2">
        {collectors.map((c) => (
          <li
            key={c.key}
            className="rounded-full border border-wine/20 bg-parchment/60 px-3 py-1 text-xs font-serif text-ink/80"
          >
            {collectorLabel(c)} &middot; {formatMoney(c.totalSpentCents)}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3 pt-1">
        {emails.length > 0 && (
          <a
            href={`mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(subject)}`}
            className="inline-flex items-center rounded-full border border-wine/30 bg-wine/5 px-4 py-1.5 text-sm font-serif text-wine hover:bg-wine/10 transition-colors"
          >
            Email them (BCC)
          </a>
        )}
        <Link href="/portal/or" className="inline-flex items-center px-1 py-1.5 text-sm font-serif text-wine underline underline-offset-4">
          Open in CRM
        </Link>
      </div>
    </div>
  );
}
