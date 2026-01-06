import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { CertificateOfAuthenticity } from './_components/certificate-of-authenticity';

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

  return <CertificateOfAuthenticity artwork={artwork} isOwner={isOwner} />;
}

