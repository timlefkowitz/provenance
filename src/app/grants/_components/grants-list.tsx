'use client';

import Link from 'next/link';
import { Card, CardContent } from '@kit/ui/card';
import { ExternalLink, Calendar, MapPin, DollarSign } from 'lucide-react';
import type { ArtistGrantRow } from '../_actions/get-artist-grants';

type GrantsListProps = {
  grants: ArtistGrantRow[];
};

function formatDeadline(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
}

export function GrantsList({ grants }: GrantsListProps) {
  if (grants.length === 0) {
    return (
      <p className="text-ink/70 font-serif text-sm py-6">
        No grants match your filters. Try adjusting search or filters—or upload your CV and ask the assistant for personalized suggestions.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {grants.map((grant) => (
        <Card key={grant.id} className="border-wine/20 bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-bold text-wine text-lg leading-tight">
                  {grant.name}
                </h3>
                {grant.url && (
                  <a
                    href={grant.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-wine hover:text-wine/80 shrink-0"
                    aria-label="Open link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              {grant.description && (
                <p className="font-serif text-sm text-ink/80 line-clamp-2">
                  {grant.description}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-xs font-serif text-ink/60">
                {grant.deadline && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDeadline(grant.deadline)}
                  </span>
                )}
                {grant.amount && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    {grant.amount}
                  </span>
                )}
                {grant.eligible_locations?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {grant.eligible_locations.slice(0, 3).join(', ')}
                    {grant.eligible_locations.length > 3 ? '…' : ''}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
