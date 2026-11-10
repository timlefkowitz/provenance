'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { USER_ROLES, type UserRole } from '~/lib/user-roles';
import { getPerspective } from '~/components/perspective-switcher';
import { AddArtworkForm } from './add-artwork-form';
import { RoleModeSwitcher } from './role-mode-switcher';
import { FirstRunBanner } from '~/components/first-run-banner';
import { Card, CardContent } from '@kit/ui/card';
import { Info } from 'lucide-react';
import type { UserExhibition } from '../_actions/get-user-exhibitions';
import type { PastArtist } from '../_actions/get-past-artists';
import type { UserProfile } from '~/app/profiles/_actions/get-user-profiles';

export function AddArtworkPageContent({
  userId,
  defaultArtistName,
  defaultMedium,
  userRole: _userRole,
  exhibitions: initialExhibitions,
  pastArtists,
  galleryProfiles,
  managedCollections = [],
  initialCollectionId,
  managedArtists = [],
  initialManagedArtistId,
  hasExistingArtworks,
  hasPaidPlan = false,
  sellingEnabled = false,
  institutionLocked = false,
}: {
  userId: string;
  defaultArtistName: string;
  defaultMedium: string;
  userRole: UserRole | null;
  exhibitions: UserExhibition[];
  pastArtists: PastArtist[];
  galleryProfiles: UserProfile[];
  /** Collector profiles the user manages for someone else */
  managedCollections?: UserProfile[];
  /** From ?collection=, preselected when posting as a collector */
  initialCollectionId?: string;
  /** Artist profiles the user manages (artist manager posting for an artist) */
  managedArtists?: UserProfile[];
  /** From ?artist=, preselected when posting in artist mode */
  initialManagedArtistId?: string;
  hasExistingArtworks: boolean;
  hasPaidPlan?: boolean;
  sellingEnabled?: boolean;
  /** Locked institution account: always posts as the institution, no mode switcher */
  institutionLocked?: boolean;
}) {
  const _router = useRouter();
  const [currentPerspective, setCurrentPerspective] = useState<UserRole>(
    institutionLocked ? USER_ROLES.INSTITUTION : USER_ROLES.ARTIST,
  );
  const [exhibitions, setExhibitions] = useState<UserExhibition[]>(initialExhibitions);

  // Load perspective from localStorage on mount
  useEffect(() => {
    if (institutionLocked) return;
    if (typeof window !== 'undefined') {
      const saved = getPerspective();
      setCurrentPerspective(saved);
    }
  }, [institutionLocked]);

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
      case USER_ROLES.INSTITUTION:
        return {
          title: 'Add Artwork to Your Institution',
          description: 'Upload artwork on behalf of your institution. A certificate of exhibition will be created and the artist will need to claim it before it can be verified.',
          info: 'You are adding artwork as an Institution. The artist will need to claim the certificate before it can be verified.',
        };
      case USER_ROLES.COLLECTOR:
        return {
          title: 'Add to Your Collection',
          description: 'Upload photos of items you own and receive a verified Certificate of Ownership immediately. Items are private by default.',
          info: 'You are adding as a Collector. A Certificate of Ownership is issued right away. If you name an artist, they can optionally claim the certificate later.',
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
      <FirstRunBanner />
      <div className="mb-8">
        {!institutionLocked && (
          <RoleModeSwitcher
            onModeChange={(mode) => setCurrentPerspective(mode)}
          />
        )}
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          {roleMessage.title}
        </h1>
        <p className="text-ink/70 font-serif">
          {roleMessage.description}
        </p>
      </div>

      {initialCollectionId && currentPerspective !== USER_ROLES.COLLECTOR && (
        <Card className="mb-6 border-wine/20 bg-wine/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-wine flex-shrink-0 mt-0.5" />
              <p className="text-sm text-ink/80 font-serif">
                Switch to Collector mode to add works to{' '}
                {managedCollections.find((c) => c.id === initialCollectionId)?.name ?? 'this collection'}.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
        exhibitions={exhibitions}
        pastArtists={pastArtists}
        galleryProfiles={galleryProfiles}
        managedCollections={managedCollections}
        initialCollectionId={initialCollectionId}
        managedArtists={managedArtists}
        initialManagedArtistId={initialManagedArtistId}
        hasExistingArtworks={hasExistingArtworks}
        hasPaidPlan={hasPaidPlan}
        sellingEnabled={sellingEnabled}
        onExhibitionsChange={(updatedExhibitions) => {
          setExhibitions(updatedExhibitions);
        }}
      />
    </>
  );
}

