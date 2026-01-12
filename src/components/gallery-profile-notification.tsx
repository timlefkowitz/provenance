'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { getPerspective } from './perspective-switcher';
import { USER_ROLES } from '~/lib/user-roles';
import pathsConfig from '~/config/paths.config';

const DISMISSED_KEY = 'gallery_profile_notification_dismissed';

export function GalleryProfileNotification() {
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Check if already dismissed
    const dismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
    if (dismissed) {
      setIsVisible(false);
      return;
    }

    // Check if perspective is Gallery
    const perspective = getPerspective();
    setIsVisible(perspective === USER_ROLES.GALLERY);
  }, [pathname]); // Re-check when route changes (which happens when perspective changes via router.refresh())

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISSED_KEY, 'true');
      setIsVisible(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Alert 
      variant="info" 
      className="sticky top-[73px] left-0 right-0 z-40 rounded-none border-x-0 border-t border-b border-wine/30 bg-wine/10 shadow-sm"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Info className="h-5 w-5 text-wine flex-shrink-0" />
          <AlertDescription className="text-ink font-serif text-sm">
            You should{' '}
            <Link 
              href={pathsConfig.app.profileSettings}
              className="text-wine hover:text-wine/80 underline font-semibold"
            >
              edit your gallery profile
            </Link>
            {' '}to complete your gallery setup.
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

