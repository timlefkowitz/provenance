'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Building2 } from 'lucide-react';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { getPerspective } from './perspective-switcher';
import { USER_ROLES } from '~/lib/user-roles';

const DISMISSED_KEY = 'gallery_profile_notification_dismissed';

export function GalleryProfileNotification() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasGalleryProfile, setHasGalleryProfile] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let cancelled = false;

    async function syncNotificationVisibility() {
      const dismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
      if (dismissed) {
        setIsVisible(false);
        setHasGalleryProfile(null);
        return;
      }

      const perspective = getPerspective();
      if (perspective !== USER_ROLES.GALLERY) {
        setIsVisible(false);
        return;
      }

      console.log('[GalleryProfileNotification] Checking gallery profile status');
      try {
        const response = await fetch('/api/check-gallery-profile', {
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          if (cancelled) return;

          setHasGalleryProfile(data.hasProfile);
          const stillDismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
          if (!stillDismissed) {
            setIsVisible(!data.hasProfile);
          }
        }
      } catch (error) {
        if (cancelled) return;
        console.error(
          '[GalleryProfileNotification] Error checking gallery profile',
          error,
        );
        const stillDismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
        if (!stillDismissed) {
          setIsVisible(true);
        }
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === DISMISSED_KEY ||
        event.key === 'user_perspective'
      ) {
        void syncNotificationVisibility();
      }
    };

    const handlePerspectiveChanged = () => {
      void syncNotificationVisibility();
    };

    void syncNotificationVisibility();
    window.addEventListener('storage', handleStorage);
    window.addEventListener(
      'user_perspective_changed',
      handlePerspectiveChanged as EventListener,
    );

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(
        'user_perspective_changed',
        handlePerspectiveChanged as EventListener,
      );
    };
  }, []);

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

