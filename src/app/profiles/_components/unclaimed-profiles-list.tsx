'use client';

import { Card, CardContent } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { ClaimProfileDialog } from './claim-profile-dialog';
import { UserPlus } from 'lucide-react';

type UnclaimedProfile = {
  id: string;
  name: string;
  medium: string | null;
  created_by_gallery_id: string | null;
  created_at: string;
  gallery: {
    id: string;
    name: string;
  } | null;
};

export function UnclaimedProfilesList({
  profiles,
}: {
  profiles: UnclaimedProfile[];
}) {
  if (profiles.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ink/60 font-serif">
          No unclaimed artist profiles available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="font-display font-bold text-wine text-lg mb-2">
          Unclaimed Artist Profiles
        </h3>
        <p className="text-ink/70 font-serif text-sm">
          These artist profiles were created by galleries. If one matches your name, you can claim it.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((profile) => (
          <Card
            key={profile.id}
            className="border-wine/20 hover:border-wine/40 transition-colors"
          >
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-display font-bold text-wine text-lg mb-1">
                    {profile.name}
                  </h4>
                  {profile.medium && (
                    <p className="text-ink/60 font-serif text-sm italic">
                      {profile.medium}
                    </p>
                  )}
                  {profile.gallery && (
                    <p className="text-ink/50 font-serif text-xs mt-2">
                      Created by {profile.gallery.name}
                    </p>
                  )}
                </div>

                <ClaimProfileDialog
                  profile={profile}
                  trigger={
                    <Button
                      variant="outline"
                      className="w-full border-wine/40 text-wine hover:bg-wine/10"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Claim Profile
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

