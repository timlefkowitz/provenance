'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@kit/ui/card';
import { RegistryFilters } from './registry-filters';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

type Account = {
  id: string;
  name: string;
  picture_url: string | null;
  public_data: any;
  created_at: string | null;
  role?: string; // For gallery profiles, this will be set
  profileId?: string; // For gallery profiles, this is the profile ID
};

type FilterType = 'all' | 'artist' | 'gallery';

type RegistryContentProps = {
  accounts: Account[];
  artworkCounts: Record<string, number>;
};

export function RegistryContent({ accounts, artworkCounts }: RegistryContentProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filteredAccounts = useMemo(() => {
    if (activeFilter === 'all') {
      return accounts;
    }

    return accounts.filter((account) => {
      // Check if account has a role property (from gallery profiles) or get from public_data
      const role = account.role || getUserRole(account.public_data as Record<string, any>);
      if (activeFilter === 'artist') {
        return role === USER_ROLES.ARTIST;
      }
      if (activeFilter === 'gallery') {
        return role === USER_ROLES.GALLERY;
      }
      return true;
    });
  }, [accounts, activeFilter]);

  return (
    <>
      <RegistryFilters onFilterChange={setActiveFilter} activeFilter={activeFilter} />

      {filteredAccounts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAccounts.map((account) => {
            const medium = account.public_data?.medium || '';
            const artworkCount = artworkCounts[account.id] || 0;
            // Check if account has a role property (from gallery profiles) or get from public_data
            const role = account.role || getUserRole(account.public_data as Record<string, any>);
            
            // Build the link URL - for galleries with profileId, include it in the query
            const linkUrl = account.profileId && role === USER_ROLES.GALLERY
              ? `/artists/${account.id}?role=gallery&profileId=${account.profileId}`
              : `/artists/${account.id}${role ? `?role=${role}` : ''}`;
            
            return (
              <Card 
                key={account.id + (account.profileId || '')}
                className="group hover:shadow-lg transition-all duration-300 border-wine/20 hover:border-wine/40 bg-white overflow-hidden"
              >
                <Link href={linkUrl} className="block">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      {/* Avatar */}
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-wine/20 group-hover:border-wine/40 transition-colors bg-wine/10">
                        {account.picture_url ? (
                          <Image
                            src={account.picture_url}
                            alt={account.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-wine/10">
                            <span className="text-2xl font-display font-bold text-wine uppercase">
                              {account.name?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <div>
                        <h3 className="font-display font-bold text-wine text-lg mb-1 group-hover:text-wine/80 transition-colors">
                          {account.name}
                        </h3>
                        
                        {/* Role Badge */}
                        <div className="mb-1">
                          <span className="text-xs font-serif uppercase tracking-wider text-ink/50">
                            {role === USER_ROLES.ARTIST ? 'Artist' : role === USER_ROLES.GALLERY ? 'Gallery' : ''}
                          </span>
                        </div>
                        
                        {/* Medium */}
                        {medium && (
                          <p className="text-ink/60 font-serif text-sm italic">
                            {medium}
                          </p>
                        )}
                      </div>

                      {/* Artwork Count */}
                      {artworkCount > 0 && (
                        <div className="text-xs text-ink/50 font-serif uppercase tracking-wider">
                          {artworkCount} {artworkCount === 1 ? 'artwork' : 'artworks'}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-ink/70 font-serif text-lg">
            {activeFilter === 'all' 
              ? 'No artists or galleries registered yet'
              : activeFilter === 'artist'
              ? 'No artists found'
              : 'No galleries found'}
          </p>
        </div>
      )}
    </>
  );
}

