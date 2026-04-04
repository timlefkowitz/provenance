'use client';

import { useCallback, useMemo, useState } from 'react';
import { getArtistGrants } from '../_actions/get-artist-grants';
import type { ArtistGrantRow } from '../_actions/get-artist-grants';
import type { SortField, LocationFilter } from './grants-filters';
import { UploadCvForm } from './upload-cv-form';
import { GrantsFilters } from './grants-filters';
import { GrantsList } from './grants-list';
import { OpportunitiesChatbot } from './opportunities-chatbot';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [mediumFilter, setMediumFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');

  const refreshGrants = useCallback(async () => {
    const next = await getArtistGrants(userId);
    setGrants(next);
  }, [userId]);

  const filteredAndSortedGrants = useMemo(() => {
    let list = [...grants];

    // Search: name, description, discipline, amount
    if (searchQuery.trim()) {
      const term = searchQuery.trim().toLowerCase();
      list = list.filter((g) => {
        const name = (g.name ?? '').toLowerCase();
        const desc = (g.description ?? '').toLowerCase();
        const amount = (g.amount ?? '').toLowerCase();
        const disciplines = (g.discipline ?? []).join(' ').toLowerCase();
        return (
          name.includes(term) ||
          desc.includes(term) ||
          amount.includes(term) ||
          disciplines.includes(term)
        );
      });
    }

    // Medium / discipline filter
    if (mediumFilter && mediumFilter !== 'all') {
      const mediumLower = mediumFilter.toLowerCase();
      list = list.filter((g) => {
        const disciplines = g.discipline ?? [];
        return disciplines.some(
          (d) =>
            d.toLowerCase() === mediumLower ||
            d.toLowerCase().includes(mediumLower) ||
            mediumLower.includes(d.toLowerCase())
        );
      });
    }

    // Location filter
    if (locationFilter === 'none') {
      list = list.filter((g) => !g.eligible_locations?.length);
    } else if (locationFilter !== 'all') {
      const locLower = locationFilter.toLowerCase();
      list = list.filter((g) =>
        g.eligible_locations?.some(
          (loc) => loc.toLowerCase() === locLower || loc.toLowerCase().includes(locLower)
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
  }, [grants, searchQuery, mediumFilter, locationFilter, sortField]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Left: grant list + filters (always shown so curated grants and search are visible) */}
      <div className="lg:col-span-3 space-y-4">
        {!hasCv && <UploadCvForm />}
        <GrantsFilters
          grants={grants}
          artistLocation={artistLocation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          mediumFilter={mediumFilter}
          onMediumFilterChange={setMediumFilter}
          locationFilter={locationFilter}
          onLocationFilterChange={setLocationFilter}
          onSortChange={setSortField}
        />
        <GrantsList grants={filteredAndSortedGrants} />
      </div>

      {/* Right: chatbot */}
      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-24">
          <OpportunitiesChatbot hasCv={hasCv} onOpportunitiesUpdated={refreshGrants} />
        </div>
      </div>
    </div>
  );
}
