'use client';

import { useState } from 'react';
import { Button } from '@kit/ui/button';
import { USER_ROLES } from '~/lib/user-roles';

type FilterType = 'all' | 'artist' | 'gallery';

type RegistryFiltersProps = {
  onFilterChange: (filter: FilterType) => void;
  activeFilter: FilterType;
};

export function RegistryFilters({ onFilterChange, activeFilter }: RegistryFiltersProps) {
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      <Button
        variant={activeFilter === 'all' ? 'default' : 'outline'}
        onClick={() => onFilterChange('all')}
        className={`font-serif ${
          activeFilter === 'all'
            ? 'bg-wine text-parchment hover:bg-wine/90'
            : 'border-wine/30 hover:bg-wine/10'
        }`}
      >
        All
      </Button>
      <Button
        variant={activeFilter === 'artist' ? 'default' : 'outline'}
        onClick={() => onFilterChange('artist')}
        className={`font-serif ${
          activeFilter === 'artist'
            ? 'bg-wine text-parchment hover:bg-wine/90'
            : 'border-wine/30 hover:bg-wine/10'
        }`}
      >
        Artists
      </Button>
      <Button
        variant={activeFilter === 'gallery' ? 'default' : 'outline'}
        onClick={() => onFilterChange('gallery')}
        className={`font-serif ${
          activeFilter === 'gallery'
            ? 'bg-wine text-parchment hover:bg-wine/90'
            : 'border-wine/30 hover:bg-wine/10'
        }`}
      >
        Galleries
      </Button>
    </div>
  );
}


