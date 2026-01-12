'use client';

import { useState, useEffect } from 'react';
import { USER_ROLES, type UserRole } from '~/lib/user-roles';
import { getPerspective } from '~/components/perspective-switcher';
import { AddArtworkForm } from './add-artwork-form';
import { RoleModeSwitcher } from './role-mode-switcher';
import { Card, CardContent } from '@kit/ui/card';
import { Info } from 'lucide-react';

export function AddArtworkPageContent({
  userId,
  defaultArtistName,
  defaultMedium,
  userRole,
}: {
  userId: string;
  defaultArtistName: string;
  defaultMedium: string;
  userRole: UserRole | null;
}) {
  const [currentPerspective, setCurrentPerspective] = useState<UserRole>(USER_ROLES.ARTIST);

  // Load perspective from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = getPerspective();
      setCurrentPerspective(saved);
    }
  }, []);

  // Role-specific messaging
  const getRoleMessage = (perspective: UserRole) => {
    switch (perspective) {
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

  const roleMessage = getRoleMessage(currentPerspective);

  return (
    <>
      <div className="mb-8">
        <RoleModeSwitcher
          onModeChange={(mode) => setCurrentPerspective(mode)}
        />
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
        userId={userId} 
        defaultArtistName={defaultArtistName}
        defaultMedium={defaultMedium}
        userRole={currentPerspective}
      />
    </>
  );
}

