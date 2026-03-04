'use client';

import { useCallback, useMemo, useState } from 'react';
import { getArtistGrants } from '../_actions/get-artist-grants';
import type { ArtistGrantRow } from '../_actions/get-artist-grants';
import type { SortField, LocationFilter } from './grants-filters';
import { UploadCvForm } from './upload-cv-form';
import { GrantsFilters } from './grants-filters';
import { GrantsList } from './grants-list';
import { GrantsChatbot } from './grants-chatbot';

type GrantsPageContentProps = {
  userId: string;
  initialGrants: ArtistGrantRow[];
  hasCv: boolean;
  artistProfileId: string;
  artistLocation: string | null;
};

export function GrantsPageContent({
  userId,
  initialGrants,
  hasCv,
  artistProfileId,
  artistLocation,
}: GrantsPageContentProps) {
  const [grants, setGrants] = useState<ArtistGrantRow[]>(initialGrants);
  const [sortField, setSortField] = useState<SortField>('deadline');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');

  const refreshGrants = useCallback(async () => {
    const next = await getArtistGrants(userId);
    setGrants(next);
  }, [userId]);

  const filteredAndSortedGrants = useMemo(() => {
    let list = [...grants];
    if (locationFilter !== 'all') {
      list = list.filter(
        (g) =>
          g.eligible_locations?.some(
            (loc) => loc.toLowerCase() === locationFilter.toLowerCase()
          )
      );
    }
    list.sort((a, b) => {
      if (sortField === 'deadline') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortField === 'amount') {
        const amtA = a.amount || '';
        const amtB = b.amount || '';
        return amtA.localeCompare(amtB);
      }
      return (a.name || '').localeCompare(b.name || '');
    });
    return list;
  }, [grants, locationFilter, sortField]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Left: grant list */}
      <div className="lg:col-span-3 space-y-4">
        {!hasCv ? (
          <UploadCvForm />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <GrantsFilters
                grants={grants}
                artistLocation={artistLocation}
                onSortChange={setSortField}
                onLocationFilterChange={setLocationFilter}
              />
            </div>
            <GrantsList grants={filteredAndSortedGrants} />
          </>
        )}
      </div>

      {/* Right: chatbot */}
      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-24">
          <GrantsChatbot hasCv={hasCv} onGrantsUpdated={refreshGrants} />
        </div>
      </div>
    </div>
  );
}
