'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@kit/ui/radio-group';
import { Label } from '@kit/ui/label';
import { USER_ROLES, getRoleLabel, type UserRole } from '~/lib/user-roles';

const PERSPECTIVE_KEY = 'user_perspective';

export function PerspectiveSwitcher() {
  const router = useRouter();
  const [perspective, setPerspective] = useState<UserRole>(USER_ROLES.ARTIST);

  // Load perspective from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PERSPECTIVE_KEY);
      if (saved && (saved === USER_ROLES.ARTIST || saved === USER_ROLES.COLLECTOR || saved === USER_ROLES.GALLERY)) {
        setPerspective(saved as UserRole);
      }
    }
  }, []);

  const handlePerspectiveChange = (value: string) => {
    const newPerspective = value as UserRole;
    setPerspective(newPerspective);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(PERSPECTIVE_KEY, newPerspective);
    }
    
    // Refresh to apply perspective changes
    router.refresh();
  };

  return (
    <div className="space-y-3 py-3 border-b border-wine/10">
      <Label className="text-sm font-serif font-semibold text-ink/80 uppercase tracking-wide">
        Perspective
      </Label>
      <RadioGroup
        value={perspective}
        onValueChange={handlePerspectiveChange}
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
      </RadioGroup>
    </div>
  );
}

/**
 * Get the current user perspective from localStorage
 */
export function getPerspective(): UserRole {
  if (typeof window === 'undefined') {
    return USER_ROLES.ARTIST; // Default on server
  }
  
  const saved = localStorage.getItem(PERSPECTIVE_KEY);
  if (saved && (saved === USER_ROLES.ARTIST || saved === USER_ROLES.COLLECTOR || saved === USER_ROLES.GALLERY)) {
    return saved as UserRole;
  }
  
  return USER_ROLES.ARTIST; // Default
}

