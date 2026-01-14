import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { CertificateOfAuthenticity } from './_components/certificate-of-authenticity';
import { isAdmin } from '~/lib/admin';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

export const metadata = {
  title: 'Certificate of Authenticity | Provenance',
};

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  // Fetch artwork - allow public access for verified artworks
  // Authenticated users can also see their own artworks
  let artwork;
  let error;

  if (user) {
    // Authenticated users can see their own artworks or verified artworks
    const { data, error: err } = await (client as any)
      .from('artworks')
      .select('*')
      .eq('id', id)
      .or(`account_id.eq.${user.id},status.eq.verified`)
      .single();
    
    artwork = data;
    error = err;
  } else {
    // Anonymous users can only see verified artworks
    const { data, error: err } = await (client as any)
      .from('artworks')
      .select('*')
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
  
  // Check if the current user is an admin
  const userIsAdmin = user ? await isAdmin(user.id) : false;

  // Get creator account info to display who created the certificate
  let creatorInfo: { name: string; role: string | null } | null = null;
  try {
    const { data: creatorAccount } = await client
      .from('accounts')
      .select('name, public_data')
      .eq('id', artwork.account_id)
      .single();
    
    if (creatorAccount) {
      const creatorRole = getUserRole(creatorAccount.public_data as Record<string, any>);
      creatorInfo = {
        name: creatorAccount.name,
        role: creatorRole,
      };
    }
  } catch (error) {
    console.error('Error fetching creator info:', error);
  }

  return (
    <CertificateOfAuthenticity 
      artwork={artwork} 
      isOwner={isOwner} 
      isAdmin={userIsAdmin}
      creatorInfo={creatorInfo}
    />
  );
}

