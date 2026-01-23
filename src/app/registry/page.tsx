import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { RegistryContent } from './_components/registry-content';
import { USER_ROLES } from '~/lib/user-roles';

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
  role?: string; // For gallery profiles, this will be set
  profileId?: string; // For gallery profiles, this is the profile ID
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
  
  // Fetch gallery profiles from user_profiles table
  const { data: galleryProfiles, error: profilesError } = await client
    .from('user_profiles')
    .select('id, user_id, name, picture_url, role, created_at')
    .eq('role', USER_ROLES.GALLERY)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(200);

  if (profilesError) {
    console.error('Error fetching gallery profiles:', profilesError);
  }

  // Combine accounts and gallery profiles
  // For galleries, use the profile data instead of account data
  const combinedList: Account[] = [];
  
  // Add gallery profiles (these take precedence over accounts for gallery role)
  if (galleryProfiles) {
    galleryProfiles.forEach((profile) => {
      combinedList.push({
        id: profile.user_id, // Use user_id for linking
        name: profile.name,
        picture_url: profile.picture_url,
        public_data: { role: USER_ROLES.GALLERY },
        created_at: profile.created_at,
        role: USER_ROLES.GALLERY,
        profileId: profile.id,
      });
    });
  }
  
  // Add accounts that aren't already represented by gallery profiles
  // (for artists and accounts without gallery profiles)
  accountsList.forEach((account) => {
    // Only add if this account doesn't have a gallery profile already in the list
    const hasGalleryProfile = galleryProfiles?.some(p => p.user_id === account.id);
    if (!hasGalleryProfile) {
      combinedList.push(account);
    }
  });

  // Get artwork counts for each account/profile
  // For gallery profiles, count by gallery_profile_id
  // For artists/accounts, count by account_id
  const artworkCounts: Record<string, number> = {};
  
  // Get all profile IDs for galleries
  const galleryProfileIds = combinedList
    .filter(a => a.role === USER_ROLES.GALLERY && a.profileId)
    .map(a => a.profileId!);
  
  // Get account IDs for artists and accounts without gallery profiles
  const artistAccountIds = combinedList
    .filter(a => a.role !== USER_ROLES.GALLERY || !a.profileId)
    .map(a => a.id);
  
  // Count artworks for gallery profiles (by gallery_profile_id)
  if (galleryProfileIds.length > 0) {
    const { data: galleryArtworks } = await client
      .from('artworks')
      .select('gallery_profile_id, account_id')
      .in('gallery_profile_id', galleryProfileIds)
      .eq('status', 'verified');
    
    galleryArtworks?.forEach(artwork => {
      if (artwork.gallery_profile_id) {
        // Use composite key: accountId-profileId for gallery profiles
        const profile = combinedList.find(
          a => a.profileId === artwork.gallery_profile_id
        );
        if (profile) {
          const key = `${profile.id}-${profile.profileId}`;
          artworkCounts[key] = (artworkCounts[key] || 0) + 1;
        }
      }
    });
  }
  
  // Count artworks for artists/accounts (by account_id, excluding those already counted for galleries)
  if (artistAccountIds.length > 0) {
    const { data: artistArtworks } = await client
      .from('artworks')
      .select('account_id, gallery_profile_id')
      .in('account_id', artistAccountIds)
      .eq('status', 'verified');
    
    artistArtworks?.forEach(artwork => {
      // Only count if it's not associated with a gallery profile (or if gallery_profile_id is null)
      // This ensures we don't double-count artworks
      if (!artwork.gallery_profile_id) {
        artworkCounts[artwork.account_id] = (artworkCounts[artwork.account_id] || 0) + 1;
      }
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

      <RegistryContent accounts={combinedList} artworkCounts={artworkCounts} />
    </div>
  );
}
