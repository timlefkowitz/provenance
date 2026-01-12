import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, getRoleLabel, USER_ROLES } from '~/lib/user-roles';
import { AddArtworkForm } from './_components/add-artwork-form';
import { Card, CardContent } from '@kit/ui/card';
import { Info } from 'lucide-react';

export const metadata = {
  title: 'Add Artwork | Provenance',
};

export default async function AddArtworkPage() {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Get account name, medium, and role for auto-filling
  const { data: account } = await client
    .from('accounts')
    .select('name, public_data')
    .eq('id', user.id)
    .single();

  const artistName = account?.name || '';
  const defaultMedium = (account?.public_data as any)?.medium || '';
  const userRole = getUserRole(account?.public_data as Record<string, any>);

  // Role-specific messaging
  const getRoleMessage = () => {
    switch (userRole) {
      case USER_ROLES.ARTIST:
        return {
          title: 'Add Your Artwork',
          description: 'Upload your artwork and create a certificate of authenticity. As the artist, you can claim and verify certificates immediately.',
          info: 'You are adding artwork as an Artist. The certificate will be automatically verified since you are the creator.',
        };
      case USER_ROLES.GALLERY:
        return {
          title: 'Add Artwork to Your Gallery',
          description: 'Upload artwork for your gallery. The certificate will need to be claimed by the artist before it can be verified.',
          info: 'You are adding artwork as a Gallery. The artist will need to claim the certificate before it can be verified.',
        };
      case USER_ROLES.COLLECTOR:
        return {
          title: 'Add Artwork to Your Collection',
          description: 'Upload artwork from your collection. The certificate will need to be claimed by the artist before it can be verified.',
          info: 'You are adding artwork as a Collector. The artist will need to claim the certificate before it can be verified.',
        };
      default:
        return {
          title: 'Add Artwork or Collectible',
          description: 'Upload an image and create a certificate of authenticity for your artwork',
          info: null,
        };
    }
  };

  const roleMessage = getRoleMessage();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="mb-4">
          {userRole && (
            <span className="inline-block px-3 py-1 text-xs font-serif font-semibold uppercase tracking-wide bg-wine/10 text-wine border border-wine/20 rounded-full mb-3">
              {getRoleLabel(userRole)}
            </span>
          )}
        </div>
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          {roleMessage.title}
        </h1>
        <p className="text-ink/70 font-serif">
          {roleMessage.description}
        </p>
      </div>

      {roleMessage.info && (
        <Card className="mb-6 border-wine/20 bg-wine/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-wine flex-shrink-0 mt-0.5" />
              <p className="text-sm text-ink/80 font-serif">
                {roleMessage.info}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <AddArtworkForm 
        userId={user.id} 
        defaultArtistName={artistName}
        defaultMedium={defaultMedium}
        userRole={userRole}
      />
    </div>
  );
}

