'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@kit/ui/radio-group';
import { Label } from '@kit/ui/label';
import { Button } from '@kit/ui/button';
import { USER_ROLES, type UserRole } from '~/lib/user-roles';
import { cn } from '@kit/ui/utils';

const PERSPECTIVE_KEY = 'user_perspective';
/** One year in seconds — matches typical session-like preferences. */
const PERSPECTIVE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function isSupportedPerspective(value: string | null | undefined): value is UserRole {
  return (
    value === USER_ROLES.ARTIST ||
    value === USER_ROLES.COLLECTOR ||
    value === USER_ROLES.GALLERY ||
    value === USER_ROLES.INSTITUTION
  );
}

/** Persist the perspective to a cookie so server components can read it without a round trip. */
function writePerspectiveCookie(value: UserRole) {
  if (typeof document === 'undefined') return;
  document.cookie = `${PERSPECTIVE_KEY}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${PERSPECTIVE_COOKIE_MAX_AGE}; samesite=lax`;
}

export function PerspectiveSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [perspective, setPerspective] = useState<UserRole>(USER_ROLES.ARTIST);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PERSPECTIVE_KEY);
      if (isSupportedPerspective(saved)) {
        setPerspective(saved);
      }
    }
  }, []);

  const handlePerspectiveChange = (value: UserRole) => {
    setPerspective(value);

    if (typeof window !== 'undefined') {
      localStorage.setItem(PERSPECTIVE_KEY, value);
      writePerspectiveCookie(value);

      window.dispatchEvent(
        new CustomEvent('user_perspective_changed', { detail: value }),
      );
    }

    router.refresh();
  };

  if (compact) {
    return (
      <div className="space-y-2 py-3 border-b border-wine/10">
        <Label className="text-xs font-serif font-semibold text-ink/80 uppercase tracking-wide">
          Switch Role
        </Label>
        <div className="flex flex-col gap-2">
          <Button
            variant={perspective === USER_ROLES.ARTIST ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePerspectiveChange(USER_ROLES.ARTIST)}
            className={cn(
              'w-full justify-start font-serif text-sm',
              perspective === USER_ROLES.ARTIST
                ? 'bg-wine text-parchment hover:bg-wine/90'
                : 'border-wine text-ink hover:bg-wine/10'
            )}
          >
            Artist
          </Button>
          <Button
            variant={perspective === USER_ROLES.COLLECTOR ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePerspectiveChange(USER_ROLES.COLLECTOR)}
            className={cn(
              'w-full justify-start font-serif text-sm',
              perspective === USER_ROLES.COLLECTOR
                ? 'bg-wine text-parchment hover:bg-wine/90'
                : 'border-wine text-ink hover:bg-wine/10'
            )}
          >
            Collector
          </Button>
          <Button
            variant={perspective === USER_ROLES.GALLERY ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePerspectiveChange(USER_ROLES.GALLERY)}
            className={cn(
              'w-full justify-start font-serif text-sm',
              perspective === USER_ROLES.GALLERY
                ? 'bg-wine text-parchment hover:bg-wine/90'
                : 'border-wine text-ink hover:bg-wine/10'
            )}
          >
            Gallery
          </Button>
          <Button
            variant={perspective === USER_ROLES.INSTITUTION ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePerspectiveChange(USER_ROLES.INSTITUTION)}
            className={cn(
              'w-full justify-start font-serif text-sm',
              perspective === USER_ROLES.INSTITUTION
                ? 'bg-wine text-parchment hover:bg-wine/90'
                : 'border-wine text-ink hover:bg-wine/10'
            )}
          >
            Institution
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-3 border-b border-wine/10">
      <Label className="text-sm font-serif font-semibold text-ink/80 uppercase tracking-wide">
        Perspective
      </Label>
      <RadioGroup
        value={perspective}
        onValueChange={(value) => handlePerspectiveChange(value as UserRole)}
        className="space-y-3"
      >
        <div className="flex items-center space-x-3">
          <RadioGroupItem value={USER_ROLES.ARTIST} id="artist" className="border-wine" />
          <Label
            htmlFor="artist"
            className="font-serif text-sm cursor-pointer flex-1 text-ink"
          >
            Artist
          </Label>
        </div>
        <div className="flex items-center space-x-3">
          <RadioGroupItem value={USER_ROLES.COLLECTOR} id="collector" className="border-wine" />
          <Label
            htmlFor="collector"
            className="font-serif text-sm cursor-pointer flex-1 text-ink"
          >
            Collector
          </Label>
        </div>
        <div className="flex items-center space-x-3">
          <RadioGroupItem value={USER_ROLES.GALLERY} id="gallery" className="border-wine" />
          <Label
            htmlFor="gallery"
            className="font-serif text-sm cursor-pointer flex-1 text-ink"
          >
            Gallery
          </Label>
        </div>
        <div className="flex items-center space-x-3">
          <RadioGroupItem value={USER_ROLES.INSTITUTION} id="institution" className="border-wine" />
          <Label
            htmlFor="institution"
            className="font-serif text-sm cursor-pointer flex-1 text-ink"
          >
            Institution
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}

/**
 * Get the current user perspective from localStorage (client only).
 * On the server, use `readPerspective()` from `~/lib/read-perspective`.
 */
export function getPerspective(): UserRole {
  if (typeof window === 'undefined') {
    return USER_ROLES.ARTIST;
  }

  const saved = localStorage.getItem(PERSPECTIVE_KEY);
  if (isSupportedPerspective(saved)) {
    return saved;
  }

  return USER_ROLES.ARTIST;
}
