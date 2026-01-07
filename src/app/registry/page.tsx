import { getSupabaseServerClient } from '@kit/supabase/server-client';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@kit/ui/card';
import { ProfileAvatar } from '@kit/ui/profile-avatar';

export const metadata = {
  title: 'Registry | Provenance',
  description: 'A directory of artists and galleries on Provenance',
};

type Account = {
  id: string;
  name: string;
  picture_url: string | null;
  public_data: any;
  created_at: string | null;
};

export default async function RegistryPage() {
  const client = getSupabaseServerClient();
  
  // Fetch all accounts (read-only, safe)
  // This uses the new public read policy that only exposes public fields
  const { data: accounts, error } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data, created_at')
    .order('name', { ascending: true })
    .limit(200); // Limit to prevent performance issues

  if (error) {
    console.error('Error fetching accounts:', error);
  }

  const accountsList: Account[] = accounts || [];

  // Get artwork counts for each account (optional, for display)
  const accountIds = accountsList.map(a => a.id);
  const artworkCounts: Record<string, number> = {};
  
  if (accountIds.length > 0) {
    // Fetch artwork counts per account (read-only)
    const { data: artworks } = await client
      .from('artworks')
      .select('account_id')
      .in('account_id', accountIds)
      .eq('status', 'verified');
    
    // Count artworks per account
    artworks?.forEach(artwork => {
      artworkCounts[artwork.account_id] = (artworkCounts[artwork.account_id] || 0) + 1;
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Registry
        </h1>
        <p className="text-ink/70 font-serif">
          A directory of artists and galleries on Provenance
        </p>
      </div>

      {accountsList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {accountsList.map((account) => {
            const medium = account.public_data?.medium || '';
            const artworkCount = artworkCounts[account.id] || 0;
            
            return (
              <Card 
                key={account.id}
                className="group hover:shadow-lg transition-all duration-300 border-wine/20 hover:border-wine/40 bg-white overflow-hidden"
              >
                <Link href={`/artworks?artist=${account.id}`} className="block">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      {/* Avatar */}
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-wine/20 group-hover:border-wine/40 transition-colors">
                        <ProfileAvatar
                          displayName={account.name}
                          pictureUrl={account.picture_url}
                          className="w-full h-full"
                          fallbackClassName="w-full h-full"
                        />
                      </div>

                      {/* Name */}
                      <div>
                        <h3 className="font-display font-bold text-wine text-lg mb-1 group-hover:text-wine/80 transition-colors">
                          {account.name}
                        </h3>
                        
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
            No artists or galleries registered yet
          </p>
        </div>
      )}
    </div>
  );
}
