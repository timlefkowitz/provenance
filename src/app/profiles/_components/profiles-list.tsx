'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { getRoleLabel } from '~/lib/user-roles';
import { UserProfile } from '../_actions/get-user-profiles';
import { Edit, ExternalLink, User, Palette, Building2 } from 'lucide-react';

export function ProfilesList({ profiles }: { profiles: UserProfile[] }) {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'artist':
        return <Palette className="h-5 w-5" />;
      case 'gallery':
        return <Building2 className="h-5 w-5" />;
      case 'collector':
        return <User className="h-5 w-5" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {profiles.map((profile) => (
        <Link
          key={profile.id}
          href={`/artists/${profile.user_id}?role=${profile.role}${profile.role === 'gallery' ? `&profileId=${profile.id}` : ''}`}
          className="block"
        >
          <Card
            className="border-wine/20 bg-white hover:shadow-md transition-shadow group cursor-pointer h-full"
          >
            <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-wine/20 bg-wine/10 flex-shrink-0">
                {profile.picture_url ? (
                  <Image
                    src={profile.picture_url}
                    alt={profile.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xl font-display font-bold text-wine uppercase">
                      {profile.name?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getRoleIcon(profile.role)}
                  <span className="text-xs font-serif text-ink/60 uppercase tracking-wide">
                    {getRoleLabel(profile.role)}
                  </span>
                </div>
                <h3 className="font-display font-bold text-wine text-lg truncate">
                  {profile.name}
                </h3>
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-ink/70 font-serif line-clamp-2 mb-4">
                {profile.bio}
              </p>
            )}

            {profile.medium && (
              <p className="text-xs text-ink/60 font-serif italic mb-4">
                {profile.medium}
              </p>
            )}

            <div className="flex items-center gap-2 pt-4 border-t border-wine/10">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="flex-1 font-serif border-wine/30 hover:bg-wine/10"
                onClick={(e) => e.stopPropagation()}
              >
                <Link href={`/profiles/${profile.id}/edit`}>
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="font-serif"
                onClick={(e) => e.stopPropagation()}
              >
                <Link href={`/artists/${profile.user_id}?role=${profile.role}`}>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>

            {!profile.is_active && (
              <div className="mt-2 text-xs text-ink/50 font-serif italic">
                (Inactive)
              </div>
            )}
          </CardContent>
        </Card>
        </Link>
      ))}
    </div>
  );
}

