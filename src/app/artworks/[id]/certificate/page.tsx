import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { CertificateOfAuthenticity } from './_components/certificate-of-authenticity';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { canEditGalleryArtworks, canManageGallery } from '~/app/profiles/_actions/gallery-members';
import { CERTIFICATE_TYPES, getUserRole, USER_ROLES } from '~/lib/user-roles';

import { getArtworkExhibition } from './_actions/get-artwork-exhibition';
import type { ArtworkAttachmentRow } from './_components/upload-attachments-dialog';

export const metadata = {
  title: 'Certificate of Authenticity | Provenance',
};

// Enable dynamic rendering for better performance
export const dynamic = 'force-dynamic';

export default async function CertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const showVerifyCta = resolvedSearchParams?.verify === '1';
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  // Fetch artwork - allow public access for verified artworks
  // Authenticated users can also see their own artworks
  // Only select the columns we need for better performance
  let artwork;
  let error;

  if (user) {
    // Authenticated users can see their own artworks or verified artworks
    const { data, error: err } = await (client as any)
      .from('artworks')
      .select(`
        id,
        account_id,
        title,
        description,
        artist_name,
        artist_account_id,
        artist_profile_id,
        creation_date,
        medium,
        dimensions,
        image_url,
        certificate_number,
        created_at,
        former_owners,
        auction_history,
        exhibition_history,
        historic_context,
        celebrity_notes,
        value,
        value_is_public,
        edition,
        production_location,
        owned_by,
        owned_by_is_public,
        sold_by,
        sold_by_is_public,
        metadata,
        status,
        certificate_status,
        certificate_type,
        gallery_profile_id
      `)
      .eq('id', id)
      .or(`account_id.eq.${user.id},status.eq.verified`)
      .single();
    
    artwork = data;
    error = err;
  } else {
    // Anonymous users can only see verified artworks
    const { data, error: err } = await (client as any)
      .from('artworks')
      .select(`
        id,
        account_id,
        title,
        description,
        artist_name,
        artist_account_id,
        artist_profile_id,
        creation_date,
        medium,
        dimensions,
        image_url,
        certificate_number,
        created_at,
        former_owners,
        auction_history,
        exhibition_history,
        historic_context,
        celebrity_notes,
        value,
        value_is_public,
        edition,
        production_location,
        owned_by,
        owned_by_is_public,
        sold_by,
        sold_by_is_public,
        metadata,
        status,
        certificate_status,
        certificate_type,
        gallery_profile_id
      `)
      .eq('id', id)
      .eq('status', 'verified')
      .single();
    
    artwork = data;
    error = err;
  }

  if (error || !artwork) {
    redirect('/artworks');
  }

  // Check if the current user is the owner
  const isOwner = !!(user && artwork.account_id === user.id);

  let canEditCertificate = false;
  if (user) {
    try {
      canEditCertificate = await canEditGalleryArtworks(user.id, {
        account_id: artwork.account_id,
        gallery_profile_id: artwork.gallery_profile_id ?? undefined,
      });
    } catch (e) {
      console.error('[Certificate] canEditGalleryArtworks failed', e);
    }
  }

  let attachments: ArtworkAttachmentRow[] = [];
  if (artwork?.id) {
    const { data: attRows, error: attErr } = await (client as any)
      .from('artwork_attachments')
      .select('id, file_url, file_name, file_type, created_at')
      .eq('artwork_id', artwork.id)
      .order('created_at', { ascending: true });
    if (attErr) {
      console.error('[Certificate] artwork_attachments query failed', attErr);
    } else {
      attachments = (attRows ?? []).map(
        (a: { id: string; file_url: string; file_name: string; file_type: string; created_at: string }) => ({
          id: a.id,
          file_url: a.file_url,
          file_name: a.file_name,
          file_type: a.file_type === 'document' ? 'document' : 'image',
          created_at: a.created_at,
        }),
      );
    }
  }

  let canRequestProvenanceAsGallery = false;
  if (user && artwork.certificate_type === CERTIFICATE_TYPES.SHOW && artwork.gallery_profile_id) {
    try {
      canRequestProvenanceAsGallery = await canManageGallery(
        user.id,
        artwork.gallery_profile_id as string,
      );
    } catch (e) {
      console.error('[Certificate] canManageGallery check failed', e);
    }
  }
  const canRequestProvenance = isOwner || canRequestProvenanceAsGallery;
  
  // Get creator account info and check admin status in parallel
  let creatorInfo: { name: string; role: string | null } | null = null;
  let userIsAdmin = false;
  
  try {
    // Fetch creator account info (needed for all users)
    const creatorAccountPromise = client
      .from('accounts')
      .select('name, public_data')
      .eq('id', artwork.account_id)
      .single();
    
    // Fetch current user's account for admin check (only if user is logged in)
    const currentUserAccountPromise = user 
      ? client
          .from('accounts')
          .select('public_data')
          .eq('id', user.id)
          .single()
      : Promise.resolve({ data: null, error: null });
    
    // Execute both queries in parallel
    const [creatorAccountResult, currentUserAccountResult] = await Promise.all([
      creatorAccountPromise,
      currentUserAccountPromise,
    ]);
    
    // Process creator info
    if (creatorAccountResult.data) {
      const creatorRole = getUserRole(creatorAccountResult.data.public_data as Record<string, any>);
      
      // For galleries, fetch the gallery profile name instead of account name
      let creatorName = creatorAccountResult.data.name;
      let profileId: string | null = null;
      let slug: string | null = null;
      if (creatorRole === USER_ROLES.GALLERY) {
        // First, try to find a profile with a specific name (like "FL!GHT")
        // Search for profiles that might be the primary gallery profile
        const { data: profilesByName } = await client
          .from('user_profiles')
          .select('*')
          .eq('user_id', artwork.account_id)
          .eq('role', USER_ROLES.GALLERY)
          .eq('is_active', true)
          .order('name', { ascending: true }); // Order by name to get consistent results
        
        let galleryProfile = null;
        
        // If there are multiple profiles, prefer one that doesn't match the account name
        // (this helps find the gallery profile like "FL!GHT" vs account name "Timothy Lefkowitz")
        if (profilesByName && profilesByName.length > 0) {
          // First, try to find a profile that doesn't match the account name
          galleryProfile = profilesByName.find(
            (p) => p.name.toLowerCase() !== creatorAccountResult.data.name.toLowerCase()
          );
          // If not found, use the first one
          if (!galleryProfile) {
            galleryProfile = profilesByName[0];
          }
        } else {
          // Fallback to getUserProfileByRole if direct query doesn't work
          galleryProfile = await getUserProfileByRole(artwork.account_id, USER_ROLES.GALLERY);
        }
        
        if (galleryProfile) {
          // Always use gallery profile name if profile exists, even if name is same as account
          creatorName = galleryProfile.name || creatorAccountResult.data.name;
          profileId = galleryProfile.id;
          slug = galleryProfile.slug || null;
        }
      }
      
      creatorInfo = {
        name: creatorName,
        role: creatorRole,
        profileId: profileId || undefined,
        slug: slug || undefined,
      };
    }
    
    // Check admin status
    if (currentUserAccountResult.data?.public_data) {
      const publicData = currentUserAccountResult.data.public_data as Record<string, any>;
      userIsAdmin = publicData.admin === true;
    }
  } catch (error) {
    console.error('Error fetching account info:', error);
  }

  // Fetch exhibition for this artwork
  const exhibition = await getArtworkExhibition(artwork.id);

  const certificateType = artwork.certificate_type || 'authenticity';

  return (
    <CertificateOfAuthenticity 
      artwork={artwork} 
      isOwner={isOwner} 
      canEditCertificate={canEditCertificate}
      canRequestProvenance={canRequestProvenance}
      isAdmin={userIsAdmin}
      creatorInfo={creatorInfo}
      exhibition={exhibition}
      showVerifyCta={showVerifyCta}
      certificateStatus={artwork.certificate_status ?? null}
      certificateType={certificateType}
      attachments={attachments}
    />
  );
}

