'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Info, Building2 } from 'lucide-react';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { getPerspective } from './perspective-switcher';
import { USER_ROLES } from '~/lib/user-roles';

const DISMISSED_KEY = 'gallery_profile_notification_dismissed';

export function GalleryProfileNotification() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasGalleryProfile, setHasGalleryProfile] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // FIRST: Check if already dismissed - if so, never show again
    const dismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
    if (dismissed) {
      setIsVisible(false);
      setHasGalleryProfile(null);
      return; // Exit early - don't do any other checks
    }

    // Check if perspective is Gallery
    const perspective = getPerspective();
    if (perspective !== USER_ROLES.GALLERY) {
      setIsVisible(false);
      return;
    }

    // Check if user has a gallery profile
    async function checkGalleryProfile() {
      try {
        // Add cache-busting query param to ensure fresh data
        const response = await fetch(`/api/check-gallery-profile?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          setHasGalleryProfile(data.hasProfile);
          // Only show notification if user doesn't have a gallery profile
          // But respect dismissal - if dismissed, don't show even if no profile
          const stillDismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
          if (!stillDismissed) {
            setIsVisible(!data.hasProfile);
          }
        }
      } catch (error) {
        console.error('Error checking gallery profile:', error);
        // Only show notification if check fails AND not dismissed
        const stillDismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
        if (!stillDismissed) {
          setIsVisible(true);
        }
      }
    }

    checkGalleryProfile();
  }, [pathname]);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      // Permanently dismiss - store in localStorage
      localStorage.setItem(DISMISSED_KEY, 'true');
      setIsVisible(false);
      // Also clear any pending state
      setHasGalleryProfile(null);
    }
  };

  if (!isVisible) {
    return null;
  }

  const profileLink = hasGalleryProfile 
    ? '/profiles' // Link to profiles page to edit
    : '/profiles/new?role=gallery'; // Link to create gallery profile

  const actionText = hasGalleryProfile
    ? 'edit your gallery profile'
    : 'create your gallery profile';

  return (
    <Alert 
      variant="info" 
      className="sticky top-[73px] left-0 right-0 z-40 rounded-none border-x-0 border-t border-b border-wine/30 bg-wine/10 shadow-sm"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Building2 className="h-5 w-5 text-wine flex-shrink-0" />
          <AlertDescription className="text-ink font-serif text-sm">
            {hasGalleryProfile ? (
              <>
                Complete your gallery setup by{' '}
                <Link 
                  href={profileLink}
                  className="text-wine hover:text-wine/80 underline font-semibold"
                >
                  editing your gallery profile
                </Link>
                .
              </>
            ) : (
              <>
                Create your gallery profile to showcase your exhibitions and connect with artists.{' '}
                <Link 
                  href={profileLink}
                  className="text-wine hover:text-wine/80 underline font-semibold"
                >
                  Create Gallery Profile →
                </Link>
              </>
            )}
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="flex-shrink-0 h-8 w-8 p-0 text-ink/60 hover:text-ink hover:bg-wine/10"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}

