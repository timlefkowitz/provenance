import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { RegistryContent } from './_components/registry-content';

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
  // Note: If you only see one account, the migration 20250107000000_allow_public_account_read.sql
  // may not have been run. Run it in your Supabase SQL Editor.
  const { data: accounts, error } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data, created_at')
    .order('name', { ascending: true })
    .limit(200); // Limit to prevent performance issues

  if (error) {
    console.error('Error fetching accounts:', error);
    console.error('If you only see one account, you may need to run the migration: 20250107000000_allow_public_account_read.sql');
  }

  const accountsList: Account[] = accounts || [];
  
  // Log for debugging
  if (accountsList.length <= 1) {
    console.warn('Registry: Only seeing', accountsList.length, 'account(s). The public read policy may not be applied.');
  }

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

      <RegistryContent accounts={accountsList} artworkCounts={artworkCounts} />
    </div>
  );
}
