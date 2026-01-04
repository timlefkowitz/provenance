import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { AddArtworkForm } from './_components/add-artwork-form';

export const metadata = {
  title: 'Add Artwork | Provenance',
};

export default async function AddArtworkPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Get account name and medium for auto-filling
  const { data: account } = await client
    .from('accounts')
    .select('name, public_data')
    .eq('id', user.id)
    .single();

  const artistName = account?.name || '';
  const defaultMedium = (account?.public_data as any)?.medium || '';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Add Artwork or Collectible
        </h1>
        <p className="text-ink/70 font-serif">
          Upload an image and create a certificate of authenticity for your artwork
        </p>
      </div>

      <AddArtworkForm 
        userId={user.id} 
        defaultArtistName={artistName}
        defaultMedium={defaultMedium}
      />
    </div>
  );
}

